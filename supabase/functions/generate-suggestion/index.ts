import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Generate suggestion function called');
    const { callId, customerMessage } = await req.json();
    console.log('Request data:', { callId, customerMessage });

    if (!callId || !customerMessage) {
      throw new Error('Missing required parameters: callId and customerMessage');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate embeddings for the customer message to search knowledge base
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const generateEmbedding = async (text: string): Promise<number[]> => {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI embeddings API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    };

    // Generate embedding for the customer message
    const messageEmbedding = await generateEmbedding(customerMessage);

    // Search knowledge base for relevant information
    const { data: knowledgeResults } = await supabase.rpc('search_knowledge_base', {
      query_embedding: messageEmbedding,
      match_threshold: 0.7,
      match_count: 3
    });

    // Get recent conversation context
    const { data: recentTranscripts } = await supabase
      .from('transcripts')
      .select('role, text, created_at')
      .eq('call_id', callId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get customer profile for context
    const { data: callData } = await supabase
      .from('calls')
      .select(`
        customer_number,
        customer_profiles (
          name,
          call_history_count,
          customer_notes,
          tags
        )
      `)
      .eq('id', callId)
      .single();

    // Build conversation context
    let conversationContext = '';
    if (recentTranscripts && recentTranscripts.length > 0) {
      conversationContext = recentTranscripts
        .reverse()
        .map(t => `${t.role}: ${t.text}`)
        .join('\n');
    }

    // Build customer context
    let customerContext = '';
    if (callData?.customer_profiles) {
      const profile = callData.customer_profiles;
      customerContext = `Customer Info: ${profile.name || 'Unknown'}, ` +
        `Call History: ${profile.call_history_count} calls, ` +
        `Notes: ${profile.customer_notes || 'None'}, ` +
        `Tags: ${profile.tags?.join(', ') || 'None'}`;
    }

    // Build knowledge base context
    let knowledgeContext = '';
    if (knowledgeResults && knowledgeResults.length > 0) {
      knowledgeContext = knowledgeResults
        .map(result => `${result.title}: ${result.content}`)
        .join('\n\n');
    }

    // Generate AI suggestion using OpenAI
    const systemPrompt = `You are an AI assistant helping customer service agents resolve customer issues. Based on the customer's message, conversation history, and relevant knowledge base information, provide a helpful, concise suggestion for how the agent should respond.

Keep suggestions under 50 words and focus on being helpful, professional, and specific to the customer's issue.

${knowledgeContext ? `Knowledge Base Information:
${knowledgeContext}

` : ''}Customer Context: ${customerContext}

Recent Conversation:
${conversationContext}

Latest Customer Message: ${customerMessage}

Provide a brief, actionable suggestion for the agent based on the available information:`;

    console.log('Calling OpenAI API with prompt');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    console.log('OpenAI API response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', data);
    const suggestion = data.choices[0].message.content;

    console.log('Generated suggestion:', suggestion);
    return new Response(
      JSON.stringify({ suggestion }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error generating suggestion:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});