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
    
    console.log('Twilio Voice Webhook:', webhookData);

    const {
      CallSid,
      From,
      To,
      CallStatus,
      Direction,
      ForwardedFrom,
      CallerName,
      Digits
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
            name: CallerName as string || null,
            call_history_count: 1,
            last_interaction_at: new Date().toISOString()
          })
          .select()
          .single();
        customerProfile = newProfile;
      } else {
        customerProfile = existingProfile;
      }
    }

    // Create or update call record
    const { data: callRecord, error: callError } = await supabase
      .from('calls')
      .upsert({
        twilio_call_sid: CallSid as string,
        customer_number: From as string,
        call_status: CallStatus as string,
        call_direction: Direction as string,
        started_at: new Date().toISOString()
      }, {
        onConflict: 'twilio_call_sid'
      })
      .select()
      .single();

    if (callError) {
      console.error('Error creating/updating call:', callError);
    }

    // Find available agent for incoming calls
    if (CallStatus === 'ringing' && Direction === 'inbound') {
      const { data: availableAgents } = await supabase
        .from('agents')
        .select('*')
        .limit(1);

      if (availableAgents && availableAgents.length > 0) {
        // Assign call to first available agent
        await supabase
          .from('calls')
          .update({ agent_id: availableAgents[0].id })
          .eq('twilio_call_sid', CallSid as string);

        // Generate TwiML to directly dial the agent's device
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">Connecting you to our agent.</Say>
          <Dial timeout="30" record="record-from-ringing">
            <Client>agent</Client>
          </Dial>
        </Response>`;

        return new Response(twiml, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/xml' 
          }
        });
      } else {
        // No agents available
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Say voice="alice">All our agents are currently busy. Please try again later.</Say>
          <Hangup/>
        </Response>`;

        return new Response(twiml, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/xml' 
          }
        });
      }
    }

    // Default response for other call states
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
    console.error('Error in twilio-voice-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});