import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_API_BASE = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}`;

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

    const { action, callSid, conferenceSid, participantSid } = await req.json();
    
    console.log('Call control action:', { action, callSid, conferenceSid, participantSid });

    const authHeader = `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`;

    let response;

    switch (action) {
      case 'mute':
        if (conferenceSid && participantSid) {
          response = await fetch(
            `${TWILIO_API_BASE}/Conferences/${conferenceSid}/Participants/${participantSid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'Muted=true',
            }
          );
        }
        break;

      case 'unmute':
        if (conferenceSid && participantSid) {
          response = await fetch(
            `${TWILIO_API_BASE}/Conferences/${conferenceSid}/Participants/${participantSid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'Muted=false',
            }
          );
        }
        break;

      case 'hold':
        if (conferenceSid && participantSid) {
          response = await fetch(
            `${TWILIO_API_BASE}/Conferences/${conferenceSid}/Participants/${participantSid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'Hold=true',
            }
          );
        }
        break;

      case 'unhold':
        if (conferenceSid && participantSid) {
          response = await fetch(
            `${TWILIO_API_BASE}/Conferences/${conferenceSid}/Participants/${participantSid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'Hold=false',
            }
          );
        }
        break;

      case 'hangup':
        if (callSid) {
          response = await fetch(
            `${TWILIO_API_BASE}/Calls/${callSid}.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'Status=completed',
            }
          );
        }
        break;

      case 'connect_agent':
        if (callSid && conferenceSid) {
          // Get available agent
          const { data: availableAgent } = await supabase
            .from('agents')
            .select('*')
            .limit(1)
            .single();

          if (availableAgent) {
            // Update call with agent assignment
            await supabase
              .from('calls')
              .update({ agent_id: availableAgent.id })
              .eq('twilio_call_sid', callSid);

            // You would typically trigger a call to the agent's phone here
            // For demo purposes, we'll just update the call status
            response = await fetch(
              `${TWILIO_API_BASE}/Conferences/${conferenceSid}.json`,
              {
                method: 'GET',
                headers: {
                  'Authorization': authHeader,
                },
              }
            );
          } else {
            throw new Error('No available agents');
          }
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    if (response && !response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${errorText}`);
    }

    const result = response ? await response.json() : { success: true };

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in twilio-call-controls:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});