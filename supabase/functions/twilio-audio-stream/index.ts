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
          
          // Clean up old buffers before starting new call
          cleanupOldBuffers();
          
          // Find the call record
          const { data: callRecord } = await supabase
            .from('calls')
            .select('id')
            .eq('twilio_call_sid', callSid)
            .single();
            
          if (callRecord) {
            callId = callRecord.id;
            activeCallSessions.add(callId);
            console.log(`Found call record: ${callId}, added to active sessions`);
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
          if (callId) {
            cleanupCallBuffers(callId);
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
    if (callId) {
      cleanupCallBuffers(callId);
    }
  });

  socket.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });

  return response;
});

// Enhanced buffer management with session isolation
let audioBuffer: { [key: string]: Uint8Array[] } = {};
let lastTranscriptTime: { [key: string]: number } = {};
let activeCallSessions: Set<string> = new Set();
let callMetrics: { [key: string]: { transcriptCount: number, lastActivity: number, errorCount: number } } = {};
let processedAudioHashes: { [key: string]: Set<string> } = {};

// Enhanced buffer cleanup with comprehensive session management
function cleanupCallBuffers(callId: string) {
  const keysToDelete = Object.keys(audioBuffer).filter(key => key.startsWith(callId));
  keysToDelete.forEach(key => {
    delete audioBuffer[key];
    delete lastTranscriptTime[key];
  });
  
  // Clean up metrics and hashes
  delete callMetrics[callId];
  delete processedAudioHashes[callId];
  
  activeCallSessions.delete(callId);
  console.log(`Comprehensive cleanup completed for call: ${callId}`);
}

// Clean up old inactive buffers (older than 5 minutes)
function cleanupOldBuffers() {
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  Object.keys(lastTranscriptTime).forEach(key => {
    if (lastTranscriptTime[key] < fiveMinutesAgo) {
      delete audioBuffer[key];
      delete lastTranscriptTime[key];
      console.log(`Cleaned up old buffer: ${key}`);
    }
  });
}

async function processAudioMessage(message: any, callId: string, supabase: any) {
  try {
    // Validate this is an active call session
    if (!activeCallSessions.has(callId)) {
      console.log(`Ignoring audio for inactive call: ${callId}`);
      return;
    }
    
    // Initialize call metrics if needed
    if (!callMetrics[callId]) {
      callMetrics[callId] = { transcriptCount: 0, lastActivity: Date.now(), errorCount: 0 };
      processedAudioHashes[callId] = new Set();
    }
    
    console.log(`Received audio chunk for call ${callId}, sequence: ${message.sequenceNumber}, track: ${message.media.track}`);
    
    const track = message.media.track;
    const audioData = message.media.payload;
    
    // Update activity timestamp
    callMetrics[callId].lastActivity = Date.now();
    
    // Validate track (should only be 'inbound' or 'outbound')
    if (!['inbound', 'outbound'].includes(track)) {
      console.log(`Invalid track: ${track}, ignoring audio`);
      return;
    }
    
    // Initialize buffers for this call if not exists
    const bufferKey = `${callId}-${track}`;
    if (!audioBuffer[bufferKey]) {
      audioBuffer[bufferKey] = [];
      lastTranscriptTime[bufferKey] = Date.now();
    }
    
    // Enhanced audio processing with quality detection
    if (audioData) {
      const binaryAudio = atob(audioData);
      const chunk = new Uint8Array(binaryAudio.length);
      for (let i = 0; i < binaryAudio.length; i++) {
        chunk[i] = binaryAudio.charCodeAt(i);
      }
      
      // Calculate audio energy to detect actual speech vs silence/noise
      const audioEnergy = calculateAudioEnergy(chunk);
      const isValidAudio = audioEnergy > 50; // Threshold for valid audio
      
      // Create hash to detect duplicate audio chunks
      const audioHash = await createAudioHash(chunk);
      
      if (isValidAudio && !processedAudioHashes[callId].has(audioHash)) {
        audioBuffer[bufferKey].push(chunk);
        processedAudioHashes[callId].add(audioHash);
        
        // Keep hash set size manageable (last 100 hashes)
        if (processedAudioHashes[callId].size > 100) {
          const hashArray = Array.from(processedAudioHashes[callId]);
          processedAudioHashes[callId] = new Set(hashArray.slice(-100));
        }
      } else {
        console.log(`Filtered out ${!isValidAudio ? 'low-energy' : 'duplicate'} audio chunk for ${track}`);
      }
    }
    
    const currentTime = Date.now();
    
    // Process accumulated audio every 3 seconds
    if (currentTime - lastTranscriptTime[bufferKey] > 3000 && audioBuffer[bufferKey].length > 0) {
      console.log(`Processing accumulated audio for ${track}, ${audioBuffer[bufferKey].length} chunks`);
      
      // Combine all audio chunks
      const totalLength = audioBuffer[bufferKey].reduce((sum, chunk) => sum + chunk.length, 0);
      
      // Enhanced audio processing thresholds (at least 2KB and maximum 50KB)
      if (totalLength > 2048 && totalLength < 51200) {
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
        
        // Call speech-to-text function with enhanced error handling
        try {
          const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('speech-to-text', {
            body: {
              audio: base64Audio,
              track: track,
              callId: callId,
              audioSize: totalLength
            }
          });
          
          if (transcriptionError) {
            console.error('Error calling speech-to-text:', transcriptionError);
            callMetrics[callId].errorCount++;
            
            // Reset transcription process if too many errors
            if (callMetrics[callId].errorCount > 5) {
              console.log(`Too many errors for call ${callId}, resetting buffers`);
              audioBuffer[bufferKey] = [];
              callMetrics[callId].errorCount = 0;
            }
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
              callMetrics[callId].errorCount++;
            } else {
              console.log(`Inserted ${role} transcript: ${transcriptText}`);
              callMetrics[callId].transcriptCount++;
              callMetrics[callId].errorCount = 0; // Reset error count on success
              
              // Enhanced AI suggestion generation with better conditions
              if (role === 'customer' && transcriptText.split(' ').length >= 4 && 
                  !isLowQuality && transcriptText.length > 15 && 
                  !/^(hello|hi|thank|thanks|bye|goodbye|yes|no|ok|okay)\s/i.test(transcriptText)) {
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
          callMetrics[callId].errorCount++;
          
          // Implement recovery mechanism for failed transcriptions
          if (callMetrics[callId].errorCount > 3) {
            console.log(`Implementing recovery for call ${callId} - clearing buffers`);
            audioBuffer[bufferKey] = [];
            lastTranscriptTime[bufferKey] = Date.now();
          }
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

// Enhanced helper functions for audio quality and text analysis

// Calculate audio energy to detect speech vs silence/noise
function calculateAudioEnergy(audioChunk: Uint8Array): number {
  let energy = 0;
  for (let i = 0; i < audioChunk.length; i++) {
    const sample = audioChunk[i] - 128; // Convert to signed
    energy += sample * sample;
  }
  return Math.sqrt(energy / audioChunk.length);
}

// Create hash for audio chunk to detect duplicates
async function createAudioHash(audioChunk: Uint8Array): Promise<string> {
  // Simple hash based on first and last bytes + length
  const start = audioChunk.slice(0, Math.min(32, audioChunk.length));
  const end = audioChunk.slice(-Math.min(32, audioChunk.length));
  const hash = Array.from(start).concat(Array.from(end)).join('') + audioChunk.length;
  return hash.slice(0, 32); // Truncate for memory efficiency
}

// Enhanced text similarity with phonetic analysis
function getSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Calculate both word-based and character-based similarity
  const wordIntersection = words1.filter(word => words2.includes(word));
  const wordUnion = [...new Set([...words1, ...words2])];
  const wordSimilarity = wordIntersection.length / wordUnion.length;
  
  // Character-based similarity for catching phonetically similar transcriptions
  const chars1 = text1.toLowerCase().replace(/\s+/g, '');
  const chars2 = text2.toLowerCase().replace(/\s+/g, '');
  const charSimilarity = calculateLevenshteinSimilarity(chars1, chars2);
  
  return Math.max(wordSimilarity, charSimilarity * 0.8);
}

// Calculate Levenshtein similarity for character-level comparison
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
  
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i] + 1, // deletion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  const distance = matrix[len2][len1];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : (maxLen - distance) / maxLen;
}