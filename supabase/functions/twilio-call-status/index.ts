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

    // Parse Twilio webhook data
    const formData = await req.formData();
    const webhookData = Object.fromEntries(formData.entries());
    
    console.log('Twilio Call Status Webhook:', webhookData);

    const {
      CallSid,
      CallStatus,
      From,
      To,
      Direction,
      CallDuration,
      RecordingUrl,
      RecordingDuration,
      CallerCountry,
      CallerState,
      CallerCity,
      ConferenceSid
    } = webhookData;

    // Find or create customer profile
    let customerProfile = null;
    if (From) {
      const { data: existingProfile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('phone_number', From as string)
        .single();

      if (!existingProfile) {
        const { data: newProfile } = await supabase
          .from('customer_profiles')
          .insert({
            phone_number: From as string,
            call_history_count: 1,
            last_interaction_at: new Date().toISOString()
          })
          .select()
          .single();
        customerProfile = newProfile;
      } else {
        // Update existing profile
        const { data: updatedProfile } = await supabase
          .from('customer_profiles')
          .update({
            call_history_count: existingProfile.call_history_count + 1,
            last_interaction_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id)
          .select()
          .single();
        customerProfile = updatedProfile;
      }
    }

    // Find or create call record
    let callRecord = null;
    const { data: existingCall } = await supabase
      .from('calls')
      .select('*')
      .eq('twilio_call_sid', CallSid as string)
      .single();

    if (!existingCall) {
      // Create new call record
      const { data: newCall } = await supabase
        .from('calls')
        .insert({
          customer_number: From as string,
          twilio_call_sid: CallSid as string,
          twilio_conference_sid: ConferenceSid as string,
          call_status: CallStatus as string,
          call_direction: Direction as string,
          caller_country: CallerCountry as string,
          caller_state: CallerState as string,
          caller_city: CallerCity as string,
          call_duration: CallDuration ? parseInt(CallDuration as string) : null,
          recording_url: RecordingUrl as string,
          recording_duration: RecordingDuration ? parseInt(RecordingDuration as string) : null,
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      callRecord = newCall;
    } else {
      // Update existing call record
      const updateData: any = {
        call_status: CallStatus as string,
        call_duration: CallDuration ? parseInt(CallDuration as string) : existingCall.call_duration,
        recording_url: RecordingUrl as string || existingCall.recording_url,
        recording_duration: RecordingDuration ? parseInt(RecordingDuration as string) : existingCall.recording_duration
      };

      if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'canceled') {
        updateData.ended_at = new Date().toISOString();
      }

      const { data: updatedCall } = await supabase
        .from('calls')
        .update(updateData)
        .eq('id', existingCall.id)
        .select()
        .single();
      callRecord = updatedCall;
    }

    // Create recording record if URL provided
    if (RecordingUrl && callRecord) {
      await supabase
        .from('call_recordings')
        .upsert({
          call_id: callRecord.id,
          twilio_recording_sid: CallSid as string + '_recording',
          recording_url: RecordingUrl as string,
          duration: RecordingDuration ? parseInt(RecordingDuration as string) : null
        });
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
    console.error('Error in twilio-call-status webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});