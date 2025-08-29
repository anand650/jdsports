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

let audioBuffer: { [key: string]: Uint8Array[] } = {};
let lastTranscriptTime: { [key: string]: number } = {};

async function processAudioMessage(message: any, callId: string, supabase: any) {
  try {
    console.log(`Received audio chunk for call ${callId}, sequence: ${message.sequenceNumber}, track: ${message.media.track}`);
    
    const track = message.media.track;
    const audioData = message.media.payload;
    
    // Initialize buffers for this call if not exists
    const bufferKey = `${callId}-${track}`;
    if (!audioBuffer[bufferKey]) {
      audioBuffer[bufferKey] = [];
      lastTranscriptTime[bufferKey] = Date.now();
    }
    
    // Decode and store audio chunk
    if (audioData) {
      const binaryAudio = atob(audioData);
      const chunk = new Uint8Array(binaryAudio.length);
      for (let i = 0; i < binaryAudio.length; i++) {
        chunk[i] = binaryAudio.charCodeAt(i);
      }
      audioBuffer[bufferKey].push(chunk);
    }
    
    const currentTime = Date.now();
    
    // Process accumulated audio every 3 seconds
    if (currentTime - lastTranscriptTime[bufferKey] > 3000 && audioBuffer[bufferKey].length > 0) {
      console.log(`Processing accumulated audio for ${track}, ${audioBuffer[bufferKey].length} chunks`);
      
      // Combine all audio chunks
      const totalLength = audioBuffer[bufferKey].reduce((sum, chunk) => sum + chunk.length, 0);
      
      // Only process if we have enough audio data (at least 1KB)
      if (totalLength > 1024) {
        const combinedAudio = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of audioBuffer[bufferKey]) {
          combinedAudio.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Convert to base64 for transmission
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < combinedAudio.length; i += chunkSize) {
          const chunk = combinedAudio.subarray(i, Math.min(i + chunkSize, combinedAudio.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Audio = btoa(binary);
        
        // Call speech-to-text function
        try {
          const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
            body: {
              audio: base64Audio,
              track: track
            }
          });
          
          if (transcriptionError) {
            console.error('Error calling speech-to-text:', transcriptionError);
          } else if (transcriptionResult?.text && transcriptionResult.text.trim().length > 0) {
            const role = track === 'inbound' ? 'customer' : 'agent';
            
            // Insert transcript into database
            const { error: insertError } = await supabase
              .from('transcripts')
              .insert({
                call_id: callId,
                role: role,
                text: transcriptionResult.text.trim(),
                created_at: new Date().toISOString()
              });
            
            if (insertError) {
              console.error('Error inserting transcript:', insertError);
            } else {
              console.log(`Inserted ${role} transcript: ${transcriptionResult.text.trim()}`);
              
              // Generate AI suggestion for customer messages
              if (role === 'customer') {
                try {
                  const { error: suggestionError } = await supabase.functions.invoke('generate-suggestion', {
                    body: {
                      callId: callId,
                      customerMessage: transcriptionResult.text.trim()
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
            }
          }
        } catch (error) {
          console.error('Error processing speech-to-text:', error);
        }
        
        // Clear buffer after processing
        audioBuffer[bufferKey] = [];
      }
      
      lastTranscriptTime[bufferKey] = currentTime;
    }
    
  } catch (error) {
    console.error('Error processing audio message:', error);
  }
}