import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Audio processing utilities
function base64ToBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// Convert MuLaw to PCM16 (simplified conversion)
function muLawToPcm16(muLawData: Uint8Array): Uint8Array {
  const pcmData = new Int16Array(muLawData.length);
  const muLawBias = 0x84;
  const muLawMax = 0x7F;
  
  for (let i = 0; i < muLawData.length; i++) {
    let muLawByte = ~muLawData[i];
    let sign = (muLawByte & 0x80);
    let exponent = (muLawByte >> 4) & 0x07;
    let mantissa = muLawByte & 0x0F;
    
    let sample = mantissa << (exponent + 3);
    sample += muLawBias << exponent;
    if (exponent === 0) sample += muLawBias >> 1;
    
    pcmData[i] = sign ? -sample : sample;
  }
  
  // Convert to Uint8Array (little endian)
  const result = new Uint8Array(pcmData.length * 2);
  for (let i = 0; i < pcmData.length; i++) {
    result[i * 2] = pcmData[i] & 0xFF;
    result[i * 2 + 1] = (pcmData[i] >> 8) & 0xFF;
  }
  
  return result;
}

Deno.serve(async (req) => {
  console.log("🚀 Twilio Audio Stream V2 started!");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.headers.get("upgrade") !== "websocket") {
    console.log("❌ Expected websocket upgrade");
    return new Response("Expected websocket", { status: 400 });
  }

  // Environment variables
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
  const ASSEMBLYAI_API_KEY="ced0df76d7fa4ecbabe510040d07a69e";
  console.log("🔧 Environment check:");
  console.log("- SUPABASE_URL:", !!SUPABASE_URL);
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", !!SUPABASE_SERVICE_ROLE_KEY);
  console.log("- ASSEMBLYAI_API_KEY:", !!ASSEMBLYAI_API_KEY);
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ASSEMBLYAI_API_KEY) {
    console.error("❌ Missing required environment variables");
    console.log("🔍 Available env vars:", Object.keys(Deno.env.toObject()));
    return new Response("Server configuration error", { status: 500 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // State variables
  let callSid: string | null = null;
  let callId: string | null = null;
  let lastTrack: "inbound" | "outbound" | null = null;
  let assemblySocket: WebSocket | null = null;
  let audioChunks: Uint8Array[] = [];
  let isAssemblyConnected = false;

  // Initialize AssemblyAI WebSocket connection
  async function initializeAssemblyAI() {
    try {
      console.log("🔌 Getting AssemblyAI realtime token...");
      
      // Get a realtime token first
      const tokenResponse = await fetch("https://api.assemblyai.com/v2/realtime/token", {
        method: "POST",
        headers: {
           authorization: "Bearer ced0df76d7fa4ecbabe510040d07a69e",
          "content-type": "application/json",
        },
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log("✅ AssemblyAI token received, expires at:", tokenData.expires_at);

      console.log("🔌 Connecting to AssemblyAI WebSocket...");
      
      assemblySocket = new WebSocket(
        `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${tokenData.token}`
      );

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("⏰ AssemblyAI connection timeout");
          assemblySocket?.close();
          reject(new Error("Connection timeout"));
        }, 10000);

        assemblySocket!.onopen = () => {
          clearTimeout(timeout);
          isAssemblyConnected = true;
          console.log("✅ AssemblyAI WebSocket connected!");
          resolve();
        };

        assemblySocket!.onerror = (error) => {
          clearTimeout(timeout);
          console.error("❌ AssemblyAI WebSocket error:", error);
          reject(error);
        };
      });

      // Handle incoming messages from AssemblyAI
      const transcriptTexts: { [key: string]: string } = {};
      
      assemblySocket.onmessage = async (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log("📥 AssemblyAI response:", response.message_type || response.type);
          
          if (response.text && response.audio_start !== undefined) {
            transcriptTexts[response.audio_start] = response.text;
            
            // Sort and combine texts by audio_start timestamp
            const keys = Object.keys(transcriptTexts).sort((a, b) => parseFloat(a) - parseFloat(b));
            let fullText = '';
            for (const key of keys) {
              if (transcriptTexts[key]) {
                fullText += ` ${transcriptTexts[key]}`;
              }
            }
            
            const cleanText = fullText.trim();
            if (cleanText && callId) {
              console.log("💬 Transcript:", cleanText);
              
              // Determine role based on last track
              const role = lastTrack === "outbound" ? "agent" : "customer";
              
              // Save transcript to database
              const { error: transcriptError } = await supabase
                .from("transcripts")
                .insert({
                  call_id: callId,
                  role,
                  text: cleanText,
                  created_at: new Date().toISOString()
                });

              if (transcriptError) {
                console.error("❌ Save transcript error:", transcriptError);
              } else {
                console.log("✅ Transcript saved!");
                
                // Generate AI suggestion for customer messages
                if (role === "customer") {
                  console.log("🤖 Generating suggestion...");
                  
                  try {
                    const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke(
                      "generate-suggestion", 
                      { body: { callId, customerMessage: cleanText } }
                    );

                    if (!suggestionError && suggestionData?.suggestion) {
                      console.log("💡 AI suggests:", suggestionData.suggestion);
                      
                      await supabase.from("suggestions").insert({
                        call_id: callId,
                        text: suggestionData.suggestion,
                        created_at: new Date().toISOString()
                      });
                      
                      console.log("✅ Suggestion saved!");
                    }
                  } catch (err) {
                    console.error("❌ Suggestion error:", err);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("❌ AssemblyAI message processing error:", error);
        }
      };

      assemblySocket.onclose = (event) => {
        isAssemblyConnected = false;
        console.log(`🔌 AssemblyAI WebSocket closed: ${event.code} - ${event.reason}`);
      };

      assemblySocket.onerror = (error) => {
        isAssemblyConnected = false;
        console.error("❌ AssemblyAI WebSocket error:", error);
      };

    } catch (error) {
      console.error("❌ Failed to initialize AssemblyAI:", error);
      throw error;
    }
  }

  // Send audio chunk to AssemblyAI
  function sendAudioChunk() {
    if (audioChunks.length >= 5 && isAssemblyConnected && assemblySocket?.readyState === WebSocket.OPEN) {
      try {
        // Combine chunks
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedBuffer = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of audioChunks) {
          combinedBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        // Convert to base64 and send
        const encodedAudio = bufferToBase64(combinedBuffer);
        
        assemblySocket.send(JSON.stringify({ 
          audio_data: encodedAudio 
        }));
        
        console.log("📤 Sent audio chunk:", combinedBuffer.length, "bytes");
        audioChunks = []; // Clear chunks after sending
        
      } catch (error) {
        console.error("❌ Error sending audio chunk:", error);
      }
    }
  }

  // Twilio WebSocket handlers
  socket.onopen = () => {
    console.log("🌐 Twilio WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("📨 Twilio event:", message.event);
      
      if (message.event === "connected") {
        console.log("🔗 Twilio connected");
      }
      
      else if (message.event === "start") {
        callSid = message.start?.callSid;
        console.log("▶️ Call started:", callSid);

        // Find call record
        if (callSid) {
          const { data: callRecord, error } = await supabase
            .from("calls")
            .select("id")
            .eq("twilio_call_sid", callSid)
            .single();

          if (callRecord) {
            callId = callRecord.id;
            console.log("✅ Call ID:", callId);
          } else {
            console.log("⚠️ No call record found for:", callSid);
          }
        }

        // Initialize AssemblyAI connection
        try {
          await initializeAssemblyAI();
          console.log("🎯 Ready for transcription!");
        } catch (error) {
          console.error("❌ AssemblyAI initialization failed:", error);
        }
      }
      
      else if (message.event === "media") {
        const track = message.media?.track;
        const audioPayload = message.media?.payload;
        
        if (track) {
          lastTrack = track;
        }

        if (audioPayload && isAssemblyConnected) {
          try {
            // Decode base64 audio from Twilio (MuLaw format)
            const muLawData = base64ToBuffer(audioPayload);
            
            // Convert MuLaw to PCM16
            const pcmData = muLawToPcm16(muLawData);
            
            // Add to chunks
            audioChunks.push(pcmData);
            
            // Send chunk when we have enough data
            sendAudioChunk();
            
          } catch (error) {
            console.error("❌ Audio processing error:", error);
          }
        }
      }
      
      else if (message.event === "stop") {
        console.log("🛑 Call ended");
        
        // Send final audio chunk if any
        if (audioChunks.length > 0) {
          sendAudioChunk();
        }
        
        // Terminate AssemblyAI session
        if (assemblySocket && isAssemblyConnected) {
          assemblySocket.send(JSON.stringify({ terminate_session: true }));
          assemblySocket.close();
          assemblySocket = null;
          isAssemblyConnected = false;
        }
      }
    } catch (error) {
      console.error("❌ Twilio message processing error:", error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Twilio WebSocket closed");
    if (assemblySocket) {
      assemblySocket.send(JSON.stringify({ terminate_session: true }));
      assemblySocket.close();
      assemblySocket = null;
      isAssemblyConnected = false;
    }
  };

  socket.onerror = (error) => {
    console.error("❌ Twilio WebSocket error:", error);
  };

  return response;
});