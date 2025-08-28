import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle WebSocket upgrade for Twilio Media Streams
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let callSid: string | null = null;
  let callId: string | null = null;
  
  socket.addEventListener("open", () => {
    console.log("WebSocket connection opened for audio streaming");
  });

  socket.addEventListener("message", async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      console.log("Received message:", message.event);

      switch (message.event) {
        case 'connected':
          console.log("Connected to Twilio Media Stream");
          break;
          
        case 'start':
          callSid = message.start.callSid;
          console.log(`Media stream started for call: ${callSid}`);
          
          // Find the call record
          const { data: callRecord } = await supabase
            .from('calls')
            .select('id')
            .eq('twilio_call_sid', callSid)
            .single();
            
          if (callRecord) {
            callId = callRecord.id;
            console.log(`Found call record: ${callId}`);
          }
          break;
          
        case 'media':
          // Handle audio data - could be used for real-time transcription
          // For now, we'll just log that we received audio data
          if (message.media && callId) {
            console.log(`Received audio chunk for call ${callId}, sequence: ${message.sequenceNumber}`);
            
            // Here you could implement real-time transcription by sending
            // the audio data to a speech-to-text service
            // For now, we'll rely on Twilio's built-in transcription
          }
          break;
          
        case 'stop':
          console.log(`Media stream stopped for call: ${callSid}`);
          break;
          
        default:
          console.log(`Unknown event: ${message.event}`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  socket.addEventListener("close", () => {
    console.log(`WebSocket connection closed for call: ${callSid}`);
  });

  socket.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });

  return response;
});