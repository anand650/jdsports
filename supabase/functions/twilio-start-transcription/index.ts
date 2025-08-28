import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
// @deno-types="npm:@types/twilio"
import twilio from "npm:twilio@5.8.1";

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

    console.log('Starting transcription for call:', callId);

    // Get the call record to find the Twilio Call SID
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .select('twilio_call_sid')
      .eq('id', callId)
      .single();

    if (callError || !callRecord || !callRecord.twilio_call_sid) {
      throw new Error('Call record not found or missing Twilio Call SID');
    }

    console.log('Found call record:', callRecord);

    // Initialize Twilio client
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    const client = twilio(accountSid, authToken);

    try {
      // Start live transcription on the call
      const stream = await client.calls(callRecord.twilio_call_sid).streams.create({
        url: `wss://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-audio-stream`,
        name: 'transcription-stream',
        track: 'both_tracks'
      });

      console.log('Started transcription stream:', stream.sid);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Transcription started',
          streamSid: stream.sid
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (twilioError) {
      console.error('Error starting Twilio transcription:', twilioError);
      throw new Error(`Failed to start transcription: ${twilioError.message}`);
    }

  } catch (error) {
    console.error('Error starting transcription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});