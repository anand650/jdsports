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

  // Connect to AssemblyAI Real-time API with retry logic
  async function connectToAssemblyAI(): Promise<void> {
    if (connectionPromise) {
      console.log("🔄 Using existing connection attempt...");
      return connectionPromise;
    }

    connectionPromise = (async () => {
      try {
        console.log("🚀 Connecting to AssemblyAI Real-time API...");
        
        // Create WebSocket connection directly with API key
        const wsUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000`;
        console.log("🔌 Creating WebSocket connection...");
        
        aaiSocket = new WebSocket(wsUrl, [], {
          headers: {
            'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`
          }
        });

        // Wait for connection to open
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error("❌ Connection timeout after 10 seconds");
            aaiSocket?.close();
            reject(new Error("Connection timeout"));
          }, 10000);

          aaiSocket!.onopen = () => {
            clearTimeout(timeout);
            console.log("✅ AssemblyAI WebSocket opened!");
            
            // Send configuration message
            const config = {
              sample_rate: 8000,
              word_boost: ["agent", "customer", "support", "help"],
              format_turns: true
            };
            console.log("📤 Sending config:", config);
            aaiSocket!.send(JSON.stringify(config));
            
            isConnected = true;
            resolve();
          };

          aaiSocket!.onerror = (error) => {
            clearTimeout(timeout);
            console.error("❌ WebSocket connection error:", error);
            isConnected = false;
            reject(new Error(`WebSocket error: ${error}`));
          };
        });

        // Set up message handlers after connection is established
        aaiSocket.onmessage = async (event) => {
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

        aaiSocket.onclose = (event) => {
          isConnected = false;
          connectionPromise = null;
          console.log(`🔌 AssemblyAI closed: ${event.code} - ${event.reason}`);
        };

        aaiSocket.onerror = (error) => {
          isConnected = false;
          connectionPromise = null;
          console.error("❌ AssemblyAI runtime error:", error);
        };

        console.log("✅ AssemblyAI setup complete!");

      } catch (error) {
        console.error("❌ Failed to connect to AssemblyAI:", error);
        isConnected = false;
        connectionPromise = null;
        throw error;
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