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
  console.log("- ASSEMBLYAI_API_KEY:", !!ASSEMBLYAI_API_KEY, "length:", ASSEMBLYAI_API_KEY?.length);

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

  // Get AssemblyAI token and connect
  async function connectToAssemblyAI() {
    try {
      console.log("🔑 Getting AssemblyAI temporary token...");
      
      const tokenResponse = await fetch("https://api.assemblyai.com/v2/realtime/token", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ASSEMBLYAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expires_in: 3600
        })
      });

      console.log("📊 Token response status:", tokenResponse.status);
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("❌ Token request failed:", tokenResponse.status, errorText);
        throw new Error(`Token request failed: ${tokenResponse.status} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const token = tokenData.token;
      console.log("✅ Token received, length:", token?.length);

      if (!token) {
        throw new Error("No token received from AssemblyAI");
      }

      // Connect to WebSocket - Twilio sends 8kHz mulaw, we'll convert to match
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${token}`;
      console.log("🔌 Connecting to AssemblyAI WebSocket...");
      
      aaiSocket = new WebSocket(wsUrl);

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("❌ AssemblyAI connection timeout after 10s");
          reject(new Error("Connection timeout"));
        }, 10000);

        aaiSocket!.onopen = () => {
          clearTimeout(timeout);
          isConnected = true;
          console.log("✅ AssemblyAI WebSocket connected!");
          resolve();
        };

        aaiSocket!.onerror = (error) => {
          clearTimeout(timeout);
          console.error("❌ AssemblyAI WebSocket error:", error);
          reject(error);
        };

        aaiSocket!.onclose = (event) => {
          clearTimeout(timeout);
          isConnected = false;
          console.log(`🔌 AssemblyAI closed (code: ${event.code}, reason: ${event.reason})`);
        };

        aaiSocket!.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("📩 AssemblyAI:", message.message_type);
            
            if (message.message_type === "SessionBegins") {
              console.log("✅ AssemblyAI session started, ID:", message.session_id);
            } else if (message.message_type === "PartialTranscript") {
              if (message.text) {
                console.log(`📝 Partial: "${message.text}"`);
              }
            } else if (message.message_type === "FinalTranscript") {
              const text = message.text?.trim();
              const confidence = message.confidence || 0;
              
              console.log(`📝 FINAL: "${text}" (conf: ${confidence})`);
              
              if (text && confidence >= 0.6 && callId) {
                const role = lastTrack === "outbound" ? "agent" : "customer";
                
                console.log(`💾 Saving transcript: ${role} -> "${text}"`);
                
                // Save transcript
                const { error: transcriptError } = await supabase
                  .from("transcripts")
                  .insert({
                    call_id: callId,
                    role,
                    text,
                    created_at: new Date().toISOString()
                  });

                if (transcriptError) {
                  console.error("❌ Transcript save error:", transcriptError);
                } else {
                  console.log("✅ Transcript saved");
                  
                  // Generate AI suggestion for customer messages
                  if (role === "customer") {
                    console.log("🤖 Generating AI suggestion...");
                    
                    try {
                      const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke(
                        "generate-suggestion",
                        { body: { callId, customerMessage: text } }
                      );

                      if (suggestionError) {
                        console.error("❌ Suggestion error:", suggestionError);
                      } else if (suggestionData?.suggestion) {
                        console.log("💡 AI suggestion:", suggestionData.suggestion);
                        
                        const { error: insertError } = await supabase
                          .from("suggestions")
                          .insert({
                            call_id: callId,
                            text: suggestionData.suggestion,
                            created_at: new Date().toISOString()
                          });

                        if (insertError) {
                          console.error("❌ Suggestion save error:", insertError);
                        } else {
                          console.log("✅ Suggestion saved");
                        }
                      }
                    } catch (error) {
                      console.error("❌ Suggestion generation error:", error);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("❌ Error processing AssemblyAI message:", error);
          }
        };
      });

    } catch (error) {
      console.error("❌ Failed to connect to AssemblyAI:", error);
      isConnected = false;
      throw error;
    }
  }

  // Twilio WebSocket handlers
  socket.onopen = () => {
    console.log("🌐 Twilio WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.event === "connected") {
        console.log("🔗 Twilio connected");
      }
      
      else if (message.event === "start") {
        callSid = message.start?.callSid;
        console.log("▶️ Call started, SID:", callSid);

        // Find call record
        if (callSid) {
          const { data: callRecord, error } = await supabase
            .from("calls")
            .select("id")
            .eq("twilio_call_sid", callSid)
            .single();

          if (error) {
            console.error("❌ Call lookup error:", error);
          } else if (callRecord) {
            callId = callRecord.id;
            console.log("✅ Found call ID:", callId);
          } else {
            console.log("⚠️ No call record found");
          }
        }

        // Connect to AssemblyAI
        try {
          console.log("🚀 Connecting to AssemblyAI...");
          await connectToAssemblyAI();
          console.log("✅ AssemblyAI connected and ready");
        } catch (error) {
          console.error("❌ AssemblyAI connection failed:", error);
        }
      }
      
      else if (message.event === "media") {
        const track = message.media?.track;
        const audioPayload = message.media?.payload;
        
        if (track) {
          lastTrack = track;
        }

        if (audioPayload && isConnected && aaiSocket?.readyState === WebSocket.OPEN) {
          try {
            // Decode base64 audio from Twilio (mulaw format)
            const binaryString = atob(audioPayload);
            const audioBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              audioBytes[i] = binaryString.charCodeAt(i);
            }
            
            // Send raw mulaw data directly to AssemblyAI
            // AssemblyAI can handle mulaw at 8kHz
            aaiSocket.send(audioBytes.buffer);
            
            // Uncomment for debugging
            // console.log("📤 Audio sent:", audioBytes.length, "bytes, track:", track);
          } catch (error) {
            console.error("❌ Audio processing error:", error);
          }
        } else if (audioPayload && !isConnected) {
          console.log("⏳ Audio received but AssemblyAI not connected");
        }
      }
      
      else if (message.event === "stop") {
        console.log("🛑 Call ended");
        
        if (aaiSocket) {
          aaiSocket.close();
          aaiSocket = null;
          isConnected = false;
        }
      }
    } catch (error) {
      console.error("❌ Twilio message error:", error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Twilio WebSocket closed");
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