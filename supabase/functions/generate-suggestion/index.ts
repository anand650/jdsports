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
    const { callId, customerMessage } = await req.json();

    if (!callId || !customerMessage) {
      throw new Error('Missing required parameters: callId and customerMessage');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Generate AI suggestion using OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are an AI assistant helping customer service agents. Based on the customer's message and conversation history, provide a helpful, concise suggestion for how the agent should respond. Keep suggestions under 50 words and focus on being helpful and professional.

Customer Context: ${customerContext}

Recent Conversation:
${conversationContext}

Latest Customer Message: ${customerMessage}

Provide a brief, actionable suggestion for the agent:`;

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

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const suggestion = data.choices[0].message.content;

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