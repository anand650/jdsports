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

    // Parse Twilio transcription webhook data
    const formData = await req.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('Twilio Transcription Webhook:', webhookData);

    const {
      CallSid,
      TranscriptionText,
      TranscriptionStatus,
      SequenceNumber,
      Track
    } = webhookData;

    // Find the call record
    const { data: callRecord } = await supabase
      .from('calls')
      .select('*')
      .eq('twilio_call_sid', CallSid as string)
      .single();

    if (!callRecord) {
      console.error('Call not found for CallSid:', CallSid);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/xml' 
          }
        }
      );
    }

    // Determine the role based on the track
    // Track 'inbound' = customer, Track 'outbound' = agent
    const role = Track === 'inbound' ? 'customer' : 'agent';

    // Create transcript record
    if (TranscriptionText && TranscriptionStatus === 'completed') {
      await supabase
        .from('transcripts')
        .insert({
          call_id: callRecord.id,
          role: role,
          text: TranscriptionText as string,
          created_at: new Date().toISOString()
        });

      // Generate AI suggestion based on transcript
      if (role === 'customer') {
        try {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-suggestion`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              callId: callRecord.id,
              customerMessage: TranscriptionText
            })
          });

          if (response.ok) {
            const suggestionData = await response.json();
            if (suggestionData.suggestion) {
              await supabase
                .from('suggestions')
                .insert({
                  call_id: callRecord.id,
                  text: suggestionData.suggestion
                });
            }
          }
        } catch (error) {
          console.error('Error generating AI suggestion:', error);
        }
      }
    }

    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/xml' 
        }
      }
    );

  } catch (error) {
    console.error('Error in twilio-transcription webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});