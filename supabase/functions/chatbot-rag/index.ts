import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId, userId, isHandoverResponse } = await req.json();

    if (!message || !sessionId) {
      throw new Error('Message and session ID are required');
    }

    console.log('Processing message:', message, 'for session:', sessionId, 'user:', userId || 'anonymous');

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Check if session is escalated or assigned to a human agent
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('status, assigned_agent_id')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      throw new Error('Failed to verify session status');
    }

    // If session is escalated or assigned to human agent, don't process AI response
    if (sessionData.status === 'escalated' || sessionData.status === 'closed' || sessionData.assigned_agent_id) {
      console.log('Session is handled by human agent, skipping AI response');
      
      // Save user message to database but don't generate AI response
      const { error: userMessageError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'user',
          content: message,
          metadata: { user_id: userId || null, blocked_ai_response: true }
        });

      if (userMessageError) {
        console.error('Error saving user message:', userMessageError);
      }

      return new Response(JSON.stringify({
        message: "A human agent is now handling your chat. They will respond to you shortly.",
        needsEscalation: false,
        humanTakeover: true,
        contextUsed: { message: 'Human agent takeover - AI response blocked' },
        success: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate embedding for the user's message for semantic search
    const queryEmbedding = await generateEmbedding(message);

    // Search knowledge base using vector similarity
    const { data: knowledgeResults, error: knowledgeError } = await supabase
      .rpc('search_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 3
      });

    if (knowledgeError) {
      console.error('Error searching knowledge base:', knowledgeError);
    }

    // Get user-specific context if user is logged in
    let userContext = '';
    let userOrders = '';
    let userCart = '';

    if (userId) {
      try {
        // Fetch user's recent orders
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            total_amount,
            status,
            created_at,
            order_items (
              quantity,
              price,
              size,
              color,
              product:products (
                name,
                brand
              )
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (orders && orders.length > 0) {
          userOrders = orders.map(order => 
            `Order ${order.order_number || '#' + order.id.slice(-8)}: £${order.total_amount} - ${order.status} - ${new Date(order.created_at).toLocaleDateString()} - Items: ${order.order_items?.map(item => `${item.quantity}x ${item.product?.name}`).join(', ')}`
          ).join('\n');
        }

        // Fetch user's current cart
        const { data: cartItems, error: cartError } = await supabase
          .from('cart_items')
          .select(`
            quantity,
            size,
            color,
            product:products (
              name,
              price,
              brand
            )
          `)
          .eq('user_id', userId);

        if (cartItems && cartItems.length > 0) {
          userCart = cartItems.map(item => 
            `${item.quantity}x ${item.product?.name} (${item.size || 'No size'}, ${item.color || 'No color'}) - £${item.product?.price}`
          ).join('\n');
        }

        userContext = `
User Account Information:
${userOrders ? `Recent Orders:\n${userOrders}\n` : 'No recent orders found.\n'}
${userCart ? `Current Cart:\n${userCart}\n` : 'Cart is empty.\n'}`;

      } catch (userError) {
        console.error('Error fetching user context:', userError);
      }
    }

    // Get general product context for recommendations
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('name, description, price, category, brand, sizes, colors')
      .eq('is_active', true)
      .limit(8);

    if (productsError) {
      console.error('Error fetching products:', productsError);
    }

    // Get session history for context
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('content, sender_type')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    }

    // Build comprehensive context
    const knowledgeContext = knowledgeResults?.map(kb => 
      `${kb.title}: ${kb.content} (Category: ${kb.category})`
    ).join('\n\n') || '';

    const productContext = products?.map(p => 
      `${p.name} by ${p.brand || 'JD Sports'} - ${p.description} - £${p.price} - Category: ${p.category} - Sizes: ${p.sizes?.join(', ') || 'Various'} - Colors: ${p.colors?.join(', ') || 'Various'}`
    ).join('\n') || '';

    const conversationHistory = messages?.map(m => 
      `${m.sender_type}: ${m.content}`
    ).join('\n') || '';

    // Determine if escalation is needed
    const escalationKeywords = ['complaint', 'refund', 'problem', 'issue', 'manager', 'speak to human', 'human agent', 'dissatisfied', 'angry', 'cancel order', 'return item'];
    const needsEscalation = escalationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Create enhanced AI prompt with handover context
    const isHandover = isHandoverResponse || false;
    const systemPrompt = `You are a helpful customer service assistant for JD Sports, a leading sports fashion retailer. You have access to comprehensive information including knowledge base, product catalog, and user-specific data.

${isHandover ? 'IMPORTANT: You are resuming this conversation after a human agent has handed the chat back to you. Welcome the customer back naturally and ask how you can continue to help them.' : ''}

CAPABILITIES:
1. Product recommendations and information
2. Size and fit guidance  
3. Order status and history inquiries
4. Returns and exchanges (365-day return policy)
5. General store policies and information
6. Shopping cart assistance

${knowledgeContext ? `KNOWLEDGE BASE:\n${knowledgeContext}\n` : ''}

${userContext ? `${userContext}` : 'User is not logged in - cannot access order history or cart information.\n'}

AVAILABLE PRODUCTS:
${productContext}

CONVERSATION HISTORY:
${conversationHistory}

GUIDELINES:
- Be friendly, professional, and enthusiastic about sports fashion
- Use specific information from the knowledge base when relevant
- Reference user's order history and cart when answering questions
- For order inquiries, use the provided order information if available
- If user asks about orders but isn't logged in, suggest they log in
- Use product information to make specific recommendations
- Always mention our 365-day return policy when relevant
- Keep responses concise but helpful
- If you don't have specific information, be honest and offer alternatives
${isHandover ? '- Welcome the customer back warmly and seamlessly continue the conversation' : ''}

${needsEscalation && !isHandover ? 'IMPORTANT: The customer seems to need human assistance. Acknowledge their concern and suggest connecting them with a human agent.' : ''}`;

    // Call OpenAI API with enhanced model
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 600,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiMessage = aiResponse.choices[0].message.content;

    console.log('AI response:', aiMessage);

    // Skip saving user message if this is a handover response
    if (!isHandoverResponse) {
      // Save user message to database
      const { error: userMessageError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'user',
          content: message,
          metadata: { user_id: userId || null }
        });

      if (userMessageError) {
        console.error('Error saving user message:', userMessageError);
      }
    }

    // Save AI response to database
    const { error: aiMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'ai',
        content: aiMessage,
        metadata: { 
          escalation_suggested: needsEscalation,
          knowledge_base_results: knowledgeResults?.length || 0,
          product_context_used: products?.length || 0,
          user_context_used: !!userId,
          has_user_orders: !!userOrders,
          has_user_cart: !!userCart
        }
      });

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
    }

    return new Response(JSON.stringify({
      message: aiMessage,
      needsEscalation,
      contextUsed: {
        knowledgeBase: knowledgeResults?.length || 0,
        products: products?.length || 0,
        userOrders: userOrders ? 'yes' : 'no',
        userCart: userCart ? 'yes' : 'no'
      },
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chatbot-rag function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});