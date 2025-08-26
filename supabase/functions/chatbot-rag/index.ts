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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, sessionId } = await req.json();

    if (!message || !sessionId) {
      throw new Error('Message and session ID are required');
    }

    console.log('Processing message:', message, 'for session:', sessionId);

    // Get product context for RAG
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('name, description, price, category, brand, sizes, colors')
      .eq('is_active', true)
      .limit(10);

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

    // Build context for the AI
    const productContext = products?.map(p => 
      `${p.name} by ${p.brand || 'JD Sports'} - ${p.description} - £${p.price} - Category: ${p.category} - Sizes: ${p.sizes?.join(', ') || 'Various'} - Colors: ${p.colors?.join(', ') || 'Various'}`
    ).join('\n') || '';

    const conversationHistory = messages?.map(m => 
      `${m.sender_type}: ${m.content}`
    ).join('\n') || '';

    // Determine if escalation is needed
    const escalationKeywords = ['complaint', 'refund', 'problem', 'issue', 'manager', 'speak to human', 'human agent', 'dissatisfied', 'angry'];
    const needsEscalation = escalationKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    // Create AI prompt with RAG context
    const systemPrompt = `You are a helpful customer service assistant for JD Sports, a leading sports fashion retailer. You have access to our current product catalog and should help customers with:

1. Product recommendations and information
2. Size and fit guidance
3. Order inquiries (ask for order number)
4. General store information
5. Returns and exchanges (365-day return policy)

Available Products:
${productContext}

Conversation History:
${conversationHistory}

Guidelines:
- Be friendly, professional, and enthusiastic about sports fashion
- Use the product information to make specific recommendations
- If asked about products not in our catalog, suggest similar alternatives
- For complex issues or complaints, acknowledge the concern and offer to escalate
- Keep responses concise but helpful
- Always mention our 365-day return policy when relevant
- If you don't know something, be honest and offer to connect them with a specialist

${needsEscalation ? 'IMPORTANT: The customer seems to need human assistance. Acknowledge their concern and suggest connecting them with a human agent.' : ''}`;

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Call OpenAI API
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
        max_tokens: 500,
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

    // Save user message to database
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'user',
        content: message,
        metadata: {}
      });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
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
          product_context_used: products?.length || 0
        }
      });

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
    }

    return new Response(JSON.stringify({
      message: aiMessage,
      needsEscalation,
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