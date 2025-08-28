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
          // Handle audio data and generate transcripts
          if (message.media && callId) {
            await processAudioMessage(message, callId, supabase);
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

let messageCounter = 0;
let lastTranscriptTime = 0;

async function processAudioMessage(message: any, callId: string, supabase: any) {
  try {
    messageCounter++;
    console.log(`Received audio chunk for call ${callId}, sequence: ${message.sequenceNumber}`);
    
    const currentTime = Date.now();
    
    // Generate realistic transcripts every 3-5 seconds to simulate speech recognition
    if (currentTime - lastTranscriptTime > 3000 && messageCounter % 150 === 0) { // Roughly every 3 seconds
      
      // Realistic conversation snippets
      const customerMessages = [
        "Hello, I need help with my order",
        "I placed an order last week but haven't received it yet",
        "My order number is 12345",
        "Can you check the status of my shipment?",
        "I'm concerned about the delivery delay",
        "Is there a tracking number available?",
        "I need to update my delivery address",
        "When can I expect to receive my order?",
        "Thank you for your help"
      ];
      
      const agentMessages = [
        "Hello! I'd be happy to help you with your order",
        "Let me look that up for you right away",
        "I can see your order in our system",
        "I'll check the tracking information for you",
        "Let me update that information",
        "I can help you with that delivery address change",
        "Your order is currently in transit",
        "You should receive it within 2-3 business days",
        "Is there anything else I can help you with today?"
      ];
      
      // Alternate between customer and agent (track determines speaker)
      const isInbound = message.media.track === 'inbound';
      const role = isInbound ? 'customer' : 'agent';
      const messages = isInbound ? customerMessages : agentMessages;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      // Insert transcript
      const { error } = await supabase
        .from('transcripts')
        .insert({
          call_id: callId,
          role: role,
          text: randomMessage,
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error inserting transcript:', error);
      } else {
        console.log(`Generated ${role} transcript: ${randomMessage}`);
      }
      
      // Generate AI suggestion for customer messages
      if (role === 'customer') {
        try {
          const { data, error: suggestionError } = await supabase.functions.invoke('generate-suggestion', {
            body: {
              callId: callId,
              customerMessage: randomMessage
            }
          });
          
          if (suggestionError) {
            console.error('Error generating AI suggestion:', suggestionError);
          } else {
            console.log('AI suggestion generated successfully');
          }
        } catch (error) {
          console.error('Error calling generate-suggestion function:', error);
        }
      }
      
      lastTranscriptTime = currentTime;
    }
    
  } catch (error) {
    console.error('Error processing audio message:', error);
  }
}