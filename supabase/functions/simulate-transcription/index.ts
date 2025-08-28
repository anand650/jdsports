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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { callId } = await req.json();

    if (!callId) {
      throw new Error('Call ID is required');
    }

    console.log('Simulating transcription for call:', callId);

    // Simulate customer and agent messages
    const simulatedTranscripts = [
      { role: 'customer', text: 'Hello, I need help with my order', delay: 1000 },
      { role: 'agent', text: 'Hi! I\'d be happy to help you with your order. Can you provide your order number?', delay: 3000 },
      { role: 'customer', text: 'Yes, it\'s order number 12345', delay: 5000 },
      { role: 'agent', text: 'Thank you! Let me look that up for you right away.', delay: 7000 },
      { role: 'customer', text: 'I haven\'t received it yet and it\'s been a week', delay: 9000 },
    ];

    // Send transcripts with delays to simulate real conversation
    for (const transcript of simulatedTranscripts) {
      setTimeout(async () => {
        try {
          // Insert transcript
          await supabase
            .from('transcripts')
            .insert({
              call_id: callId,
              role: transcript.role,
              text: transcript.text,
              created_at: new Date().toISOString()
            });

          console.log(`Inserted ${transcript.role} transcript: ${transcript.text}`);

          // Generate AI suggestion for customer messages
          if (transcript.role === 'customer') {
            try {
              const response = await supabase.functions.invoke('generate-suggestion', {
                body: {
                  callId: callId,
                  customerMessage: transcript.text
                }
              });

              if (response.data?.suggestion) {
                await supabase
                  .from('suggestions')
                  .insert({
                    call_id: callId,
                    text: response.data.suggestion
                  });

                console.log('Generated AI suggestion:', response.data.suggestion);
              }
            } catch (suggestionError) {
              console.error('Error generating suggestion:', suggestionError);
            }
          }
        } catch (error) {
          console.error('Error inserting simulated transcript:', error);
        }
      }, transcript.delay);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Transcription simulation started',
        transcriptCount: simulatedTranscripts.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error simulating transcription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});