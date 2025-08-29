// // Deno Edge Function: Twilio Media Streams → AssemblyAI Realtime → Supabase
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

// serve(async (req) => {
//   if (req.headers.get("upgrade") !== "websocket") {
//     return new Response("Expected websocket", { status: 400 });
//   }

//   const { socket, response } = Deno.upgradeWebSocket(req);

//   const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
//   const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
//   const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";

//   const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

//   let callSid: string | null = null;
//   let callId: string | null = null;
//   let lastTrack: "inbound" | "outbound" | null = null;

//   let aaiSocket: WebSocket | null = null;
//   let aaiOpen = false;
//   const pendingFrames: string[] = [];

//   const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

//   async function connectAssemblyAI() {
//     if (!ASSEMBLYAI_API_KEY) {
//       console.error("❌ ASSEMBLYAI_API_KEY missing");
//       return;
//     }

//     const aaiUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${ASSEMBLYAI_API_KEY}`;

//     try {
//       aaiSocket = new WebSocket(aaiUrl);

//       aaiSocket.onopen = () => {
//         aaiOpen = true;
//         console.log("✅ Connected to AssemblyAI");

//         if (pendingFrames.length) {
//           console.log(`▶️ Flushing ${pendingFrames.length} buffered frames to AssemblyAI`);
//           for (const frame of pendingFrames) {
//             try {
//               aaiSocket?.send(JSON.stringify({ audio_data: frame }));
//             } catch (e) {
//               console.error("❌ Error sending buffered frame to AssemblyAI:", e);
//             }
//           }
//           pendingFrames.length = 0;
//         }
//       };

//       aaiSocket.onmessage = async (evt) => {
//         try {
//           const msg = JSON.parse(evt.data as string);
//           console.log("📩 AssemblyAI message:", JSON.stringify(msg));

//           if (msg.message_type === "FinalTranscript") {
//             const text: string = (msg.text ?? "").trim();
//             const confidence: number = msg.confidence ?? 0;

//             if (!text) {
//               console.log("ℹ️ Empty transcript ignored");
//               return;
//             }

//             console.log(`📝 Final transcript received | conf=${confidence} | text="${text}"`);

//             if (confidence >= 0.5) {
//               const role = lastTrack === "outbound" ? "agent" : "customer";
//               console.log(`💾 Saving transcript for role=${role}, callId=${callId}`);

//               if (!callId) {
//                 console.warn("⚠️ Final transcript but callId not ready:", text);
//                 return;
//               }

//               const { error: insertErr } = await supabase.from("transcripts").insert({
//                 call_id: callId,
//                 role,
//                 text,
//                 created_at: new Date().toISOString(),
//               });

//               if (insertErr) {
//                 console.error("❌ Error inserting transcript:", insertErr);
//               } else {
//                 console.log("✅ Transcript inserted into DB");

//                 if (role === "customer") {
//                   console.log("🤖 Invoking suggestion generator...");
//                   try {
//                     const { data: sugData, error: sugErr } = await supabase.functions.invoke("generate-suggestion", {
//                       body: { callId, customerMessage: text },
//                     });
//                     if (sugErr) {
//                       console.error("❌ generate-suggestion error:", sugErr);
//                     } else if (sugData?.suggestion) {
//                       console.log("💾 Inserting AI suggestion:", sugData.suggestion);
//                       const { error: sugInsErr } = await supabase.from("suggestions").insert({
//                         call_id: callId,
//                         text: sugData.suggestion,
//                         created_at: new Date().toISOString(),
//                       });
//                       if (sugInsErr) {
//                         console.error("❌ Error inserting suggestion:", sugInsErr);
//                       } else {
//                         console.log("✅ Suggestion inserted into DB");
//                       }
//                     }
//                   } catch (e) {
//                     console.error("❌ Error invoking generate-suggestion:", e);
//                   }
//                 }
//               }
//             }
//           } else if (msg.message_type === "PartialTranscript") {
//             console.log(`📝 Partial transcript: "${msg.text}"`);
//           }
//         } catch (e) {
//           console.error("❌ Error parsing AssemblyAI message:", e);
//         }
//       };

//       aaiSocket.onclose = () => {
//         aaiOpen = false;
//         console.log("🔌 AssemblyAI WebSocket closed");
//       };

//       aaiSocket.onerror = (e) => {
//         console.error("❌ AssemblyAI WebSocket error:", e);
//       };
//     } catch (e) {
//       console.error("❌ Failed to connect to AssemblyAI:", e);
//     }
//   }

//   socket.onopen = () => {
//     console.log("🌐 Twilio Media Streams WS opened");
//   };

//   socket.onmessage = async (event) => {
//     try {
//       const msg = JSON.parse(event.data);
//       console.log("📨 Twilio event:", msg.event);

//       switch (msg.event) {
//         case "connected":
//           console.log("🔗 Twilio connected");
//           break;

//         case "start": {
//           callSid = msg?.start?.callSid ?? null;
//           console.log("▶️ Twilio start for CallSid:", callSid);

//           if (callSid) {
//             const { data: callRec, error } = await supabase
//               .from("calls")
//               .select("id")
//               .eq("twilio_call_sid", callSid)
//               .single();
//             if (error) {
//               console.error("❌ Error fetching call record:", error);
//             } else if (callRec) {
//               callId = callRec.id;
//               console.log("✅ Mapped to call_id:", callId);
//             }
//           }

//           await connectAssemblyAI();
//           break;
//         }

//         case "media": {
//           const track = msg?.media?.track as "inbound" | "outbound" | undefined;
//           if (track) {
//             lastTrack = track;
//             console.log(`🎙️ Media frame received from Twilio, track=${track}`);
//           }

//           const b64 = msg?.media?.payload as string | undefined;
//           if (!b64) break;

//           console.log(`📦 Audio frame received (base64 length=${b64.length})`);

//           if (aaiOpen && aaiSocket?.readyState === WebSocket.OPEN) {
//             try {
//               aaiSocket.send(JSON.stringify({ audio_data: b64 }));
//               console.log("➡️ Sent audio frame to AssemblyAI");
//             } catch (e) {
//               console.error("❌ Error sending frame to AssemblyAI:", e);
//             }
//           } else {
//             console.log("⏳ AssemblyAI not ready, buffering frame");
//             pendingFrames.push(b64);
//           }
//           break;
//         }

//         case "stop":
//           console.log("⏹️ Twilio stop for CallSid:", callSid);
//           try {
//             if (aaiSocket?.readyState === WebSocket.OPEN) {
//               aaiSocket.send(JSON.stringify({ terminate_session: true }));
//             }
//             aaiSocket?.close();
//           } catch {}
//           break;
//       }
//     } catch (e) {
//       console.error("❌ Error processing Twilio message:", e);
//     }
//   };

//   socket.onclose = () => {
//     console.log("🔌 Twilio WS closed for CallSid:", callSid);
//     try {
//       aaiSocket?.close();
//     } catch {}
//   };

//   socket.onerror = (e) => {
//     console.error("❌ Twilio WS error:", e);
//   };

//   return response;
// });
// Deno Edge Function: Twilio Media Streams → AssemblyAI Realtime → Supabase
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

serve(async (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ASSEMBLYAI_API_KEY = Deno.env.get("ASSEMBLYAI_API_KEY") ?? "";

  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ASSEMBLYAI_API_KEY) {
    console.error("❌ Missing required environment variables");
    socket.close(1011, "Server configuration error");
    return response;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let callSid: string | null = null;
  let callId: string | null = null;
  let lastTrack: "inbound" | "outbound" | null = null;

  let aaiSocket: WebSocket | null = null;
  let aaiOpen = false;
  const pendingFrames: string[] = [];
  let connectionAttempts = 0;
  const maxConnectionAttempts = 3;

  // === μ-law → PCM16 decoding ===
  function mulawToPCM16(mulawSample: number): number {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;
    mulawSample = ~mulawSample;
    const sign = (mulawSample & 0x80) ? -1 : 1;
    let exponent = (mulawSample >> 4) & 0x07;
    let mantissa = mulawSample & 0x0F;
    let sample = ((mantissa << 3) + MULAW_BIAS) << (exponent + 3);
    return sign * (sample > MULAW_MAX ? MULAW_MAX : sample);
  }

  function decodeMuLawToPCM16(muLawBuffer: Uint8Array): Int16Array {
    const pcmBuffer = new Int16Array(muLawBuffer.length);
    for (let i = 0; i < muLawBuffer.length; i++) {
      pcmBuffer[i] = mulawToPCM16(muLawBuffer[i]);
    }
    return pcmBuffer;
  }

  const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const u8ToB64 = (buf: Uint8Array) => btoa(String.fromCharCode(...buf));

  // === Connect to AssemblyAI with better error handling ===
  async function connectAssemblyAI(): Promise<void> {
    if (connectionAttempts >= maxConnectionAttempts) {
      console.error("❌ Max connection attempts reached for AssemblyAI");
      return;
    }

    connectionAttempts++;
    console.log(`🔄 Attempting to connect to AssemblyAI (attempt ${connectionAttempts}/${maxConnectionAttempts})`);

    if (!ASSEMBLYAI_API_KEY) {
      console.error("❌ ASSEMBLYAI_API_KEY missing");
      return;
    }

    let token: string | null = null;
    try {
      console.log("🔑 Requesting AssemblyAI realtime token...");
      const resp = await fetch("https://api.assemblyai.com/v2/realtime/token", {
        method: "POST",
        headers: { 
          "authorization": ASSEMBLYAI_API_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({}), // Empty body but properly formatted
      });

      if (!resp.ok) {
        console.error(`❌ AssemblyAI token request failed: ${resp.status} ${resp.statusText}`);
        const errorText = await resp.text();
        console.error("Response:", errorText);
        return;
      }

      const data = await resp.json();
      token = data?.token ?? null;
      console.log("✅ AssemblyAI token received");
    } catch (e) {
      console.error("❌ Failed to fetch AssemblyAI realtime token:", e);
      return;
    }

    if (!token) {
      console.error("❌ No token received from AssemblyAI");
      return;
    }

    const aaiUrl = `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=8000&token=${token}`;
    console.log("🔌 Connecting to AssemblyAI WebSocket...");

    try {
      aaiSocket = new WebSocket(aaiUrl);

      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (!aaiOpen) {
          console.error("❌ AssemblyAI connection timeout");
          aaiSocket?.close();
        }
      }, 10000); // 10 second timeout

      aaiSocket.onopen = () => {
        clearTimeout(connectionTimeout);
        aaiOpen = true;
        connectionAttempts = 0; // Reset on successful connection
        console.log("✅ Connected to AssemblyAI");

        // Send any buffered frames
        if (pendingFrames.length > 0) {
          console.log(`▶️ Flushing ${pendingFrames.length} buffered frames to AssemblyAI`);
          for (const frame of pendingFrames) {
            try {
              if (aaiSocket?.readyState === WebSocket.OPEN) {
                aaiSocket.send(JSON.stringify({ audio_data: frame }));
              }
            } catch (e) {
              console.error("❌ Error sending buffered frame to AssemblyAI:", e);
            }
          }
          pendingFrames.length = 0;
        }
      };

      aaiSocket.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          console.log("📩 AssemblyAI message:", JSON.stringify(msg));

          if (msg.message_type === "FinalTranscript") {
            const text: string = (msg.text ?? "").trim();
            const confidence: number = msg.confidence ?? 0;

            if (!text) {
              console.log("ℹ️ Empty transcript ignored");
              return;
            }

            console.log(`📝 Final transcript received | conf=${confidence} | text="${text}"`);

            if (confidence >= 0.5) {
              const role = lastTrack === "outbound" ? "agent" : "customer";
              console.log(`💾 Saving transcript for role=${role}, callId=${callId}`);

              if (!callId) {
                console.warn("⚠️ Final transcript but callId not ready:", text);
                return;
              }

              const { error: insertErr } = await supabase.from("transcripts").insert({
                call_id: callId,
                role,
                text,
                created_at: new Date().toISOString(),
              });

              if (insertErr) {
                console.error("❌ Error inserting transcript:", insertErr);
              } else {
                console.log("✅ Transcript inserted into DB");

                // Generate suggestions for customer messages
                if (role === "customer") {
                  console.log("🤖 Invoking suggestion generator...");
                  try {
                    const { data: sugData, error: sugErr } = await supabase.functions.invoke("generate-suggestion", {
                      body: { callId, customerMessage: text },
                    });
                    if (sugErr) {
                      console.error("❌ generate-suggestion error:", sugErr);
                    } else if (sugData?.suggestion) {
                      console.log("💾 Inserting AI suggestion:", sugData.suggestion);
                      const { error: sugInsErr } = await supabase.from("suggestions").insert({
                        call_id: callId,
                        text: sugData.suggestion,
                        created_at: new Date().toISOString(),
                      });
                      if (sugInsErr) {
                        console.error("❌ Error inserting suggestion:", sugInsErr);
                      } else {
                        console.log("✅ Suggestion inserted into DB");
                      }
                    }
                  } catch (e) {
                    console.error("❌ Error invoking generate-suggestion:", e);
                  }
                }
              }
            } else {
              console.log(`⚠️ Low confidence transcript ignored: ${confidence}`);
            }
          } else if (msg.message_type === "PartialTranscript") {
            console.log(`📝 Partial transcript: "${msg.text}"`);
          } else if (msg.message_type === "SessionBegins") {
            console.log("✅ AssemblyAI session began");
          } else if (msg.message_type === "SessionTerminated") {
            console.log("⏹️ AssemblyAI session terminated");
          }
        } catch (e) {
          console.error("❌ Error parsing AssemblyAI message:", e);
        }
      };

      aaiSocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        aaiOpen = false;
        console.log(`🔌 AssemblyAI WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        
        // Attempt to reconnect if not a normal closure and we haven't exceeded max attempts
        if (event.code !== 1000 && connectionAttempts < maxConnectionAttempts) {
          console.log("🔄 Attempting to reconnect to AssemblyAI in 2 seconds...");
          setTimeout(() => {
            connectAssemblyAI();
          }, 2000);
        }
      };

      aaiSocket.onerror = (e) => {
        clearTimeout(connectionTimeout);
        console.error("❌ AssemblyAI WebSocket error:", e);
      };
    } catch (e) {
      console.error("❌ Failed to connect to AssemblyAI:", e);
    }
  }

  // === Twilio Media Stream events ===
  socket.onopen = () => {
    console.log("🌐 Twilio Media Streams WS opened");
  };

  socket.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      console.log("📨 Twilio event:", msg.event);

      switch (msg.event) {
        case "connected":
          console.log("🔗 Twilio connected");
          break;

        case "start": {
          callSid = msg?.start?.callSid ?? null;
          console.log("▶️ Twilio start for CallSid:", callSid);

          if (callSid) {
            try {
              const { data: callRec, error } = await supabase
                .from("calls")
                .select("id")
                .eq("twilio_call_sid", callSid)
                .single();
              
              if (error) {
                console.error("❌ Error fetching call record:", error);
              } else if (callRec) {
                callId = callRec.id;
                console.log("✅ Mapped to call_id:", callId);
              } else {
                console.warn("⚠️ No call record found for CallSid:", callSid);
              }
            } catch (e) {
              console.error("❌ Error mapping CallSid to call_id:", e);
            }
          }

          // Connect to AssemblyAI after we have the call details
          await connectAssemblyAI();
          break;
        }

        case "media": {
          const track = msg?.media?.track as "inbound" | "outbound" | undefined;
          if (track) {
            lastTrack = track;
            // Reduce logging verbosity for media frames
            if (Math.random() < 0.1) { // Log only 10% of media frames
              console.log(`🎙️ Media frame received from Twilio, track=${track}`);
            }
          }

          const b64 = msg?.media?.payload as string | undefined;
          if (!b64) break;

          // Reduce logging for audio frames
          if (Math.random() < 0.1) {
            console.log(`📦 Audio frame received (base64 length=${b64.length})`);
          }

          try {
            // Decode μ-law → PCM16 and re-encode to base64
            const muLaw = b64ToU8(b64);
            const pcm16 = decodeMuLawToPCM16(muLaw);
            const pcmB64 = u8ToB64(new Uint8Array(pcm16.buffer));

            if (aaiOpen && aaiSocket?.readyState === WebSocket.OPEN) {
              aaiSocket.send(JSON.stringify({ audio_data: pcmB64 }));
              // Reduce logging for successful sends
              if (Math.random() < 0.01) {
                console.log("➡️ Sent PCM16 audio frame to AssemblyAI");
              }
            } else {
              // Buffer frames if AssemblyAI isn't ready, but limit buffer size
              if (pendingFrames.length < 1000) { // Limit to prevent memory issues
                pendingFrames.push(pcmB64);
              }
              if (Math.random() < 0.1) {
                console.log("⏳ AssemblyAI not ready, buffering frame");
              }
            }
          } catch (e) {
            console.error("❌ Error processing audio frame:", e);
          }
          break;
        }

        case "stop":
          console.log("⏹️ Twilio stop for CallSid:", callSid);
          try {
            if (aaiSocket?.readyState === WebSocket.OPEN) {
              aaiSocket.send(JSON.stringify({ terminate_session: true }));
              console.log("📤 Sent session termination to AssemblyAI");
            }
            aaiSocket?.close(1000, "Call ended");
          } catch (e) {
            console.error("❌ Error closing AssemblyAI connection:", e);
          }
          break;

        default:
          console.log(`ℹ️ Unhandled Twilio event: ${msg.event}`);
      }
    } catch (e) {
      console.error("❌ Error processing Twilio message:", e);
    }
  };

  socket.onclose = (event) => {
    console.log(`🔌 Twilio WS closed for CallSid: ${callSid} (code: ${event.code})`);
    try {
      if (aaiSocket?.readyState === WebSocket.OPEN) {
        aaiSocket.close(1000, "Twilio connection closed");
      }
    } catch (e) {
      console.error("❌ Error closing AssemblyAI on Twilio close:", e);
    }
  };

  socket.onerror = (e) => {
    console.error("❌ Twilio WS error:", e);
  };

  return response;
});