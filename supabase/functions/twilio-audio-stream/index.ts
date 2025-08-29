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
            const transcriptText = transcriptionResult.text.trim();
            
            // Enhanced duplicate and quality check with better filtering
            const { data: recentTranscripts, error: fetchError } = await supabase
              .from('transcripts')
              .select('text, created_at')
              .eq('call_id', callId)
              .eq('role', role)
              .order('created_at', { ascending: false })
              .limit(20);
            
            if (fetchError) {
              console.error('Error fetching recent transcripts:', fetchError);
              // Continue processing even if we can't check for duplicates
            }
            
            // Skip if this exact text was transcribed in the last 60 seconds
            const isDuplicate = recentTranscripts?.some(transcript => 
              transcript.text.toLowerCase().trim() === transcriptText.toLowerCase().trim() && 
              (Date.now() - new Date(transcript.created_at).getTime()) < 60000
            );
            
            // Skip if very similar text (>85% similarity) was transcribed recently
            const isSimilar = recentTranscripts?.some(transcript => {
              const similarity = getSimilarity(transcript.text.toLowerCase(), transcriptText.toLowerCase());
              const timeDiff = Date.now() - new Date(transcript.created_at).getTime();
              return similarity > 0.85 && timeDiff < 30000;
            });
            
            // Enhanced low-quality detection
            const isLowQuality = transcriptText.length < 3 || 
                                 transcriptText.split(' ').length < 1 ||
                                 /^(uh|um|ah|er|hmm|well|so|like|you know|thank you|thanks|ok|okay|yes|no|yeah|yep|bye|hello|hi)\s*[.!?]*\s*$/i.test(transcriptText) ||
                                 /^[.!?]+\s*$/.test(transcriptText) ||
                                 transcriptText.split(' ').every(word => word.length <= 2);
            
            if (isDuplicate || isSimilar || isLowQuality) {
              console.log(`Skipping ${isDuplicate ? 'duplicate' : isSimilar ? 'similar' : 'low-quality'} transcript: ${transcriptText}`);
              return;
            }
            
            // Insert transcript into database
            const { error: insertError } = await supabase
              .from('transcripts')
              .insert({
                call_id: callId,
                role: role,
                text: transcriptText,
                created_at: new Date().toISOString()
              });
            
            if (insertError) {
              console.error('Error inserting transcript:', insertError);
            } else {
              console.log(`Inserted ${role} transcript: ${transcriptText}`);
              
              // Generate AI suggestion for customer messages with significant content
              if (role === 'customer' && transcriptText.split(' ').length >= 3 && 
                  !isLowQuality && transcriptText.length > 10) {
                console.log(`Generating AI suggestion for customer message: ${transcriptText}`);
                
                // Don't generate suggestions too frequently (max 1 per 10 seconds)
                const { data: recentSuggestions } = await supabase
                  .from('suggestions')
                  .select('created_at')
                  .eq('call_id', callId)
                  .order('created_at', { ascending: false })
                  .limit(1);
                
                const canGenerateSuggestion = !recentSuggestions?.length || 
                  (Date.now() - new Date(recentSuggestions[0].created_at).getTime()) > 10000;
                
                if (canGenerateSuggestion) {
                  try {
                    const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-suggestion', {
                      body: {
                        callId: callId,
                        customerMessage: transcriptText
                      }
                    });
                    
                    if (suggestionError) {
                      console.error('Error generating AI suggestion:', suggestionError);
                    } else if (suggestionData?.suggestion && suggestionData.suggestion.length > 10) {
                      console.log('AI suggestion generated successfully:', suggestionData.suggestion);
                      
                      // Insert the suggestion into the database
                      const { error: insertSuggestionError } = await supabase
                        .from('suggestions')
                        .insert({
                          call_id: callId,
                          text: suggestionData.suggestion,
                          created_at: new Date().toISOString()
                        });
                      
                      if (insertSuggestionError) {
                        console.error('Error inserting suggestion:', insertSuggestionError);
                      } else {
                        console.log('Suggestion inserted successfully');
                      }
                    } else {
                      console.log('No valid suggestion returned from generate-suggestion function');
                    }
                  } catch (error) {
                    console.error('Error calling generate-suggestion function:', error);
                  }
                } else {
                  console.log('Skipping AI suggestion - too recent');
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

// Helper function to calculate text similarity
function getSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
}