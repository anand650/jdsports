import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

serve(async (req) => {
  console.log("🚀 Starting Twilio Audio Stream function");
  
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  // Environment variables
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ASSEMBLYAI_API_KEY) {
    console.error("❌ Missing required environment variables");
    socket.close(1011, "Server configuration error");
    return response;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // State variables
  let callSid: string | null = null;
  let callId: string | null = null;
  let lastTrack: "inbound" | "outbound" | null = null;
  let aaiSocket: WebSocket | null = null;
  let isConnected = false;

  // Simple AssemblyAI connection function
  async function connectToAssemblyAI() {
    try {
      console.log("🔑 Getting AssemblyAI token...");
      
      const tokenResponse = await fetch("https://api.assemblyai.com/v2/realtime/token", {
        method: "POST",
        headers: {
          "authorization": ASSEMBLYAI_API_KEY,
          "content-type": "application/json"
        }
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token request failed: ${tokenResponse.status}`);
      }

      const { token } = await tokenResponse.json();
      console.log("✅ AssemblyAI token received");

      // Connect to WebSocket with 8kHz sample rate (Twilio's default)
      const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${token}`;
      aaiSocket = new WebSocket(wsUrl);

      aaiSocket.onopen = () => {
        isConnected = true;
        console.log("✅ AssemblyAI WebSocket connected");
      };

      aaiSocket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.message_type === "FinalTranscript" && message.text?.trim()) {
            const text = message.text.trim();
            const confidence = message.confidence || 0;
            
            console.log(`📝 Transcript: "${text}" (confidence: ${confidence})`);
            
            if (confidence >= 0.7 && callId) {
              const role = lastTrack === "outbound" ? "agent" : "customer";
              
              console.log(`💾 Saving transcript for ${role}`);
              
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
                        console.log("✅ AI suggestion saved");
                      }
                    }
                  } catch (error) {
                    console.error("❌ Error in suggestion generation:", error);
                  }
                }
              }
            }
          } else if (message.message_type === "PartialTranscript") {
            console.log(`📝 Partial: "${message.text}"`);
          }
        } catch (error) {
          console.error("❌ Error processing AssemblyAI message:", error);
        }
      };

      aaiSocket.onclose = () => {
        isConnected = false;
        console.log("🔌 AssemblyAI WebSocket closed");
      };

      aaiSocket.onerror = (error) => {
        console.error("❌ AssemblyAI WebSocket error:", error);
      };

    } catch (error) {
      console.error("❌ Failed to connect to AssemblyAI:", error);
    }
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
          }
        }

        // Start AssemblyAI connection
        await connectToAssemblyAI();
      }
      
      else if (message.event === "media") {
        const track = message.media?.track;
        const audioData = message.media?.payload;
        
        if (track) {
          lastTrack = track;
        }

        if (audioData && isConnected && aaiSocket?.readyState === WebSocket.OPEN) {
          // Send audio directly to AssemblyAI (it expects base64 μ-law audio from Twilio)
          aaiSocket.send(JSON.stringify({ audio_data: audioData }));
        }
      }
      
      else if (message.event === "stop") {
        console.log("⏹️ Call ended");
        if (aaiSocket?.readyState === WebSocket.OPEN) {
          aaiSocket.send(JSON.stringify({ terminate_session: true }));
        }
        aaiSocket?.close();
      }

    } catch (error) {
      console.error("❌ Error processing Twilio message:", error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Twilio WebSocket closed");
    aaiSocket?.close();
  };

  socket.onerror = (error) => {
    console.error("❌ Twilio WebSocket error:", error);
  };

  return response;
});