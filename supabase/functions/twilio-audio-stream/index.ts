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

  console.log("🔧 Starting audio stream function");
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
  let connectionPromise: Promise<void> | null = null;

  // Message handlers setup function
  function setupMessageHandlers() {
    console.log("🔧 Setting up message handlers...");
    
    aaiSocket!.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("📥 AssemblyAI message:", message.message_type, message.text || '');
        
        if (message.message_type === "SessionBegins") {
          console.log("📡 AssemblyAI session started:", message.session_id);
        } 
        else if (message.message_type === "PartialTranscript") {
          if (message.text) {
            console.log(`🔄 Partial: "${message.text}"`);
          }
        } 
        else if (message.message_type === "FinalTranscript") {
          const text = message.text?.trim();
          const confidence = message.confidence || 0;
          
          console.log(`✨ FINAL: "${text}" (confidence: ${confidence})`);
          
          if (text && confidence >= 0.3 && callId) {
            const role = lastTrack === "outbound" ? "agent" : "customer";
            
            console.log(`💾 Saving: ${role} said "${text}"`);
            
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
              console.error("❌ Save error:", transcriptError);
            } else {
              console.log("✅ Transcript saved!");
              
              // Generate AI suggestion for customer messages
              if (role === "customer") {
                console.log("🤖 Generating suggestion...");
                
                try {
                  const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke(
                    "generate-suggestion", 
                    { body: { callId, customerMessage: text } }
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
        else if (message.message_type === "SessionTerminated") {
          console.log("⚠️ Session terminated");
          isConnected = false;
        }
      } catch (error) {
        console.error("❌ Message processing error:", error);
      }
    };

    aaiSocket!.onclose = (event) => {
      isConnected = false;
      connectionPromise = null;
      console.log(`🔌 AssemblyAI closed: ${event.code} - ${event.reason}`);
    };

    aaiSocket!.onerror = (error) => {
      isConnected = false;
      connectionPromise = null;
      console.error("❌ AssemblyAI runtime error:", error);
    };
  }
  async function connectToAssemblyAI(): Promise<void> {
    if (connectionPromise) {
      console.log("🔄 Using existing connection attempt...");
      return connectionPromise;
    }

    connectionPromise = (async () => {
      console.log("🚀 Testing multiple AssemblyAI connection approaches...");
      
      // APPROACH 1: Direct WebSocket with Authorization header
      try {
        console.log("📋 APPROACH 1: Direct WebSocket with Authorization header");
        const wsUrl1 = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000`;
        console.log("🔌 URL:", wsUrl1);
        
        aaiSocket = new WebSocket(wsUrl1, [], {
          headers: {
            'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`
          }
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log("⏰ APPROACH 1: Timeout - trying next approach");
            aaiSocket?.close();
            reject(new Error("Approach 1 timeout"));
          }, 5000);

          aaiSocket!.onopen = () => {
            clearTimeout(timeout);
            console.log("✅ APPROACH 1: Success! WebSocket opened");
            isConnected = true;
            resolve();
          };

          aaiSocket!.onerror = (error) => {
            clearTimeout(timeout);
            console.log("❌ APPROACH 1: Failed -", error);
            reject(new Error("Approach 1 failed"));
          };
        });

        // If we get here, approach 1 worked
        console.log("🎉 APPROACH 1: Connection successful!");
        setupMessageHandlers();
        return;

      } catch (error) {
        console.log("🔄 APPROACH 1: Failed, trying approach 2...");
      }

      // APPROACH 2: Token-based connection
      try {
        console.log("📋 APPROACH 2: Token-based connection");
        
        const tokenResponse = await fetch("https://api.assemblyai.com/v2/realtime/token", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ASSEMBLYAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            expires_in: 3600,
            word_boost: ["agent", "customer", "support", "help"],
            format_turns: true
          })
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        console.log("✅ APPROACH 2: Got token");

        const wsUrl2 = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${tokenData.token}`;
        console.log("🔌 APPROACH 2: URL with token");
        
        aaiSocket = new WebSocket(wsUrl2);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log("⏰ APPROACH 2: Timeout - trying next approach");
            aaiSocket?.close();
            reject(new Error("Approach 2 timeout"));
          }, 5000);

          aaiSocket!.onopen = () => {
            clearTimeout(timeout);
            console.log("✅ APPROACH 2: Success! WebSocket opened");
            isConnected = true;
            resolve();
          };

          aaiSocket!.onerror = (error) => {
            clearTimeout(timeout);
            console.log("❌ APPROACH 2: Failed -", error);
            reject(new Error("Approach 2 failed"));
          };
        });

        console.log("🎉 APPROACH 2: Connection successful!");
        setupMessageHandlers();
        return;

      } catch (error) {
        console.log("🔄 APPROACH 2: Failed, trying approach 3...");
      }

      // APPROACH 3: Different sample rate (16000)
      try {
        console.log("📋 APPROACH 3: 16kHz sample rate");
        
        const tokenResponse = await fetch("https://api.assemblyai.com/v2/realtime/token", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ASSEMBLYAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            expires_in: 3600,
          })
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        console.log("✅ APPROACH 3: Got token for 16kHz");

        const wsUrl3 = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${tokenData.token}`;
        console.log("🔌 APPROACH 3: URL with 16kHz");
        
        aaiSocket = new WebSocket(wsUrl3);

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log("⏰ APPROACH 3: Timeout - trying next approach");
            aaiSocket?.close();
            reject(new Error("Approach 3 timeout"));
          }, 5000);

          aaiSocket!.onopen = () => {
            clearTimeout(timeout);
            console.log("✅ APPROACH 3: Success! WebSocket opened");
            isConnected = true;
            resolve();
          };

          aaiSocket!.onerror = (error) => {
            clearTimeout(timeout);
            console.log("❌ APPROACH 3: Failed -", error);
            reject(new Error("Approach 3 failed"));
          };
        });

        console.log("🎉 APPROACH 3: Connection successful!");
        setupMessageHandlers();
        return;

      } catch (error) {
        console.log("🔄 APPROACH 3: Failed, trying approach 4...");
      }

      // APPROACH 4: Simple connection without extra parameters
      try {
        console.log("📋 APPROACH 4: Simple connection");
        
        const wsUrl4 = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000`;
        console.log("🔌 APPROACH 4: Simple URL");
        
        aaiSocket = new WebSocket(wsUrl4);

        // Send auth after connection
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.log("⏰ APPROACH 4: Timeout");
            aaiSocket?.close();
            reject(new Error("Approach 4 timeout"));
          }, 5000);

          aaiSocket!.onopen = () => {
            clearTimeout(timeout);
            console.log("✅ APPROACH 4: WebSocket opened, sending auth");
            
            // Send authentication message
            aaiSocket!.send(JSON.stringify({
              authorization: ASSEMBLYAI_API_KEY,
              sample_rate: 8000
            }));
            
            isConnected = true;
            resolve();
          };

          aaiSocket!.onerror = (error) => {
            clearTimeout(timeout);
            console.log("❌ APPROACH 4: Failed -", error);
            reject(new Error("Approach 4 failed"));
          };
        });

        console.log("🎉 APPROACH 4: Connection successful!");
        setupMessageHandlers();
        return;

      } catch (error) {
        console.log("❌ ALL APPROACHES FAILED!");
        throw new Error("All AssemblyAI connection approaches failed");
      }
    })();

    return connectionPromise;
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

        // Connect to AssemblyAI
        try {
          await connectToAssemblyAI();
          console.log("🎯 Ready for transcription!");
        } catch (error) {
          console.error("❌ AssemblyAI setup failed:", error);
        }
      }
      
      else if (message.event === "media") {
        const track = message.media?.track;
        const audioPayload = message.media?.payload;
        
        if (track) {
          lastTrack = track;
        }

        if (audioPayload) {
          if (isConnected && aaiSocket?.readyState === WebSocket.OPEN) {
            try {
              // Decode base64 audio from Twilio
              const binaryString = atob(audioPayload);
              const audioBytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                audioBytes[i] = binaryString.charCodeAt(i);
              }
              
              // Send raw audio to AssemblyAI (they handle mulaw decoding)
              aaiSocket.send(audioBytes.buffer);
              
              // Log occasionally for debugging
              if (Math.random() < 0.001) { // 0.1% chance
                console.log("📤 Audio sent:", audioBytes.length, "bytes");
              }
            } catch (error) {
              console.error("❌ Audio error:", error);
            }
          } else {
            console.log("⏳ Audio received but AssemblyAI not connected");
          }
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
      console.error("❌ Twilio error:", error);
    }
  };

  socket.onclose = () => {
    console.log("🔌 Twilio closed");
    if (aaiSocket) {
      aaiSocket.close();
      aaiSocket = null;
      isConnected = false;
    }
  };

  socket.onerror = (error) => {
    console.error("❌ Twilio error:", error);
  };

  return response;
});