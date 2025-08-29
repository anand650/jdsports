import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY")!;

  console.log("🔧 Environment check:");
  console.log("- SUPABASE_URL:", !!SUPABASE_URL);
  console.log("- SUPABASE_SERVICE_ROLE_KEY:", !!SUPABASE_SERVICE_ROLE_KEY);
  console.log("- ASSEMBLYAI_API_KEY:", !!ASSEMBLYAI_API_KEY);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ASSEMBLYAI_API_KEY) {
    console.error("❌ Missing required environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // State variables
  let callSid: string | null = null;
  let callId: string | null = null;
  let lastTrack: "inbound" | "outbound" | null = null;
  let aaiSocket: WebSocket | null = null;
  let isConnected = false;

  // Connect to AssemblyAI using their streaming transcriber approach
  async function connectToAssemblyAI() {
    try {
      console.log("🔑 Connecting to AssemblyAI Streaming API...");
      
      // Use the streaming endpoint directly with API key (similar to their SDK approach)
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&word_boost=["agent","customer","support"]&format_turns=true`;
      console.log("🔌 Connecting to:", wsUrl);
      
      aaiSocket = new WebSocket(wsUrl, [], {
        headers: {
          'Authorization': ASSEMBLYAI_API_KEY
        }
      });

      const connectionTimeout = setTimeout(() => {
        console.error("❌ AssemblyAI connection timeout");
        if (aaiSocket) {
          aaiSocket.close();
          aaiSocket = null;
        }
        isConnected = false;
      }, 10000);

      aaiSocket.onopen = () => {
        clearTimeout(connectionTimeout);
        isConnected = true;
        console.log("✅ AssemblyAI WebSocket connected successfully!");
      };

      aaiSocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📩 AssemblyAI message type:", message.message_type || 'unknown');
          
          if (message.message_type === "SessionBegins") {
            console.log("✅ AssemblyAI session began with ID:", message.session_id);
          } else if (message.message_type === "PartialTranscript") {
            console.log(`📝 Partial transcript: "${message.text}"`);
          } else if (message.message_type === "FinalTranscript") {
            const text = message.text?.trim();
            const confidence = message.confidence || 0;
            
            console.log(`📝 Final Transcript: "${text}" (confidence: ${confidence})`);
            
            if (text && confidence >= 0.7 && callId) {
              const role = lastTrack === "outbound" ? "agent" : "customer";
              
              console.log(`💾 Saving transcript for ${role}, callId: ${callId}`);
              
              // Insert transcript
              const { error: transcriptError } = await supabase
                .from("transcripts")
                .insert({
                  call_id: callId,
                  role,
                  text,
                  created_at: new Date().toISOString()
                });

              if (transcriptError) {
                console.error("❌ Error saving transcript:", transcriptError);
              } else {
                console.log("✅ Transcript saved successfully");
                
                // Generate AI suggestion for customer messages
                if (role === "customer") {
                  console.log("🤖 Generating AI suggestion...");
                  
                  try {
                    const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke(
                      "generate-suggestion",
                      { body: { callId, customerMessage: text } }
                    );

                    if (suggestionError) {
                      console.error("❌ Suggestion generation error:", suggestionError);
                    } else if (suggestionData?.suggestion) {
                      console.log("💾 Saving AI suggestion:", suggestionData.suggestion);
                      
                      const { error: insertError } = await supabase
                        .from("suggestions")
                        .insert({
                          call_id: callId,
                          text: suggestionData.suggestion,
                          created_at: new Date().toISOString()
                        });

                      if (insertError) {
                        console.error("❌ Error saving suggestion:", insertError);
                      } else {
                        console.log("✅ AI suggestion saved successfully");
                      }
                    } else {
                      console.log("⚠️ No suggestion returned from function");
                    }
                  } catch (error) {
                    console.error("❌ Error in suggestion generation:", error);
                  }
                }
              }
            } else {
              console.log(`⚠️ Skipping transcript - text: "${text}", confidence: ${confidence}, callId: ${callId}`);
            }
          } else if (message.message_type === "SessionTerminated") {
            console.log("⚠️ AssemblyAI session terminated:", message.message);
            isConnected = false;
          } else {
            console.log(`ℹ️ Other AssemblyAI message: ${message.message_type}`, message);
          }
        } catch (error) {
          console.error("❌ Error processing AssemblyAI message:", error);
        }
      };

      aaiSocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        isConnected = false;
        console.log(`🔌 AssemblyAI WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        if (event.code !== 1000) {
          console.error("❌ AssemblyAI connection closed unexpectedly");
        }
      };

      aaiSocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error("❌ AssemblyAI WebSocket error:", error);
        isConnected = false;
      };

    } catch (error) {
      console.error("❌ Failed to connect to AssemblyAI:", error);
      isConnected = false;
    }
  }

  // Convert Twilio mulaw audio to PCM16 format expected by AssemblyAI
  function convertMulawToPCM16(mulawData: Uint8Array): Uint8Array {
    // mulaw to linear conversion table
    const MULAW_TO_LINEAR = [
      -32124,-31100,-30076,-29052,-28028,-27004,-25980,-24956,
      -23932,-22908,-21884,-20860,-19836,-18812,-17788,-16764,
      -15996,-15484,-14972,-14460,-13948,-13436,-12924,-12412,
      -11900,-11388,-10876,-10364,-9852,-9340,-8828,-8316,
      -7932,-7676,-7420,-7164,-6908,-6652,-6396,-6140,
      -5884,-5628,-5372,-5116,-4860,-4604,-4348,-4092,
      -3900,-3772,-3644,-3516,-3388,-3260,-3132,-3004,
      -2876,-2748,-2620,-2492,-2364,-2236,-2108,-1980,
      -1884,-1820,-1756,-1692,-1628,-1564,-1500,-1436,
      -1372,-1308,-1244,-1180,-1116,-1052,-988,-924,
      -876,-844,-812,-780,-748,-716,-684,-652,
      -620,-588,-556,-524,-492,-460,-428,-396,
      -372,-356,-340,-324,-308,-292,-276,-260,
      -244,-228,-212,-196,-180,-164,-148,-132,
      -120,-112,-104,-96,-88,-80,-72,-64,
      -56,-48,-40,-32,-24,-16,-8,0,
      32124,31100,30076,29052,28028,27004,25980,24956,
      23932,22908,21884,20860,19836,18812,17788,16764,
      15996,15484,14972,14460,13948,13436,12924,12412,
      11900,11388,10876,10364,9852,9340,8828,8316,
      7932,7676,7420,7164,6908,6652,6396,6140,
      5884,5628,5372,5116,4860,4604,4348,4092,
      3900,3772,3644,3516,3388,3260,3132,3004,
      2876,2748,2620,2492,2364,2236,2108,1980,
      1884,1820,1756,1692,1628,1564,1500,1436,
      1372,1308,1244,1180,1116,1052,988,924,
      876,844,812,780,748,716,684,652,
      620,588,556,524,492,460,428,396,
      372,356,340,324,308,292,276,260,
      244,228,212,196,180,164,148,132,
      120,112,104,96,88,80,72,64,
      56,48,40,32,24,16,8,0
    ];

    // Convert mulaw to 16-bit PCM and upsample from 8kHz to 16kHz
    const pcm16Array = new Int16Array(mulawData.length * 2); // Double for upsampling
    
    for (let i = 0; i < mulawData.length; i++) {
      const linearValue = MULAW_TO_LINEAR[mulawData[i]];
      // Upsample: duplicate each sample
      pcm16Array[i * 2] = linearValue;
      pcm16Array[i * 2 + 1] = linearValue;
    }
    
    return new Uint8Array(pcm16Array.buffer);
  }

  // Twilio WebSocket event handlers
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
        console.log("▶️ Call started, CallSid:", callSid);

        if (callSid) {
          // Find the call record in our database
          console.log("🔍 Looking up call record for CallSid:", callSid);
          const { data: callRecord, error } = await supabase
            .from("calls")
            .select("id")
            .eq("twilio_call_sid", callSid)
            .single();

          if (error) {
            console.error("❌ Error finding call record:", error);
          } else if (callRecord) {
            callId = callRecord.id;
            console.log("✅ Found call ID:", callId);
          } else {
            console.log("⚠️ No call record found for CallSid:", callSid);
          }
        }

        // Start AssemblyAI connection
        console.log("🚀 Starting AssemblyAI connection...");
        await connectToAssemblyAI();
      }
      
      else if (message.event === "media") {
        const track = message.media?.track;
        const audioData = message.media?.payload;
        
        if (track) {
          lastTrack = track;
          console.log("🎙️ Audio track:", track);
        }

        if (audioData && isConnected && aaiSocket?.readyState === WebSocket.OPEN) {
          console.log("📦 Processing audio data, length:", audioData.length);
          
          try {
            // Decode base64 mulaw audio data from Twilio
            const binaryString = atob(audioData);
            const mulawData = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              mulawData[i] = binaryString.charCodeAt(i);
            }
            
            // Convert mulaw to PCM16 and upsample to 16kHz
            const pcm16Data = convertMulawToPCM16(mulawData);
            
            // Send PCM16 data directly to AssemblyAI
            aaiSocket.send(pcm16Data);
            console.log("📤 Sent PCM16 audio to AssemblyAI, size:", pcm16Data.length);
          } catch (error) {
            console.error("❌ Error processing audio for AssemblyAI:", error);
          }
        } else {
          if (!isConnected) {
            console.log("⏳ AssemblyAI not ready - isConnected: false");
          }
          if (!aaiSocket || aaiSocket.readyState !== WebSocket.OPEN) {
            console.log("⏳ AssemblyAI WebSocket not open, state:", aaiSocket?.readyState);
          }
        }
      }
      
      else if (message.event === "stop") {
        console.log("🛑 Call ended");
        
        // Close AssemblyAI connection gracefully
        if (aaiSocket) {
          console.log("🔌 Closing AssemblyAI connection...");
          aaiSocket.close(1000, "Call ended");
          aaiSocket = null;
          isConnected = false;
        }
      }
    } catch (error) {
      console.error("❌ Error processing Twilio message:", error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Twilio WebSocket closed");
    
    // Clean up AssemblyAI connection
    if (aaiSocket) {
      aaiSocket.close();
      aaiSocket = null;
      isConnected = false;
    }
  };

  socket.onerror = (error) => {
    console.error("❌ Twilio WebSocket error:", error);
  };

  return response;
});