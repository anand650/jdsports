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
  let deepgramSocket: WebSocket | null = null;
  
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
            
            // Connect to Deepgram transcription service
            try {
              const deepgramUrl = `${Deno.env.get('SUPABASE_URL')?.replace('https://', 'wss://')}/functions/v1/deepgram-transcription`;
              deepgramSocket = new WebSocket(deepgramUrl);
              
              deepgramSocket.onopen = () => {
                console.log('Connected to Deepgram transcription service');
                deepgramSocket?.send(JSON.stringify({
                  event: 'start',
                  callId: callId
                }));
              };
              
              deepgramSocket.onerror = (error) => {
                console.error('Deepgram connection error:', error);
              };
              
              deepgramSocket.onclose = () => {
                console.log('Deepgram connection closed');
              };
              
            } catch (error) {
              console.error('Error connecting to Deepgram service:', error);
            }
          }
          break;
          
        case 'media':
          // Forward audio data to Deepgram transcription service
          if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN && message.media) {
            deepgramSocket.send(JSON.stringify({
              event: 'media',
              media: message.media,
              track: message.media.track
            }));
          }
          break;
          
        case 'stop':
          console.log(`Media stream stopped for call: ${callSid}`);
          if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
            deepgramSocket.send(JSON.stringify({
              event: 'stop',
              callId: callId
            }));
            deepgramSocket.close();
          }
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
    if (deepgramSocket) {
      deepgramSocket.close();
    }
  });

  socket.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });

  return response;
});