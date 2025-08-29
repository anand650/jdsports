// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// };

// serve(async (req) => {
//   // Handle WebSocket upgrade for Twilio Media Streams
//   if (req.headers.get("upgrade") !== "websocket") {
//     return new Response("Expected websocket", { status: 400 });
//   }

//   const { socket, response } = Deno.upgradeWebSocket(req);
  
//   const supabase = createClient(
//     Deno.env.get('SUPABASE_URL') ?? '',
//     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//   );

//   const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

//   let callSid: string | null = null;
//   let callId: string | null = null;
//   let deepgramSocket: WebSocket | null = null;
  
//   socket.addEventListener("open", () => {
//     console.log("WebSocket connection opened for audio streaming");
//   });

//   socket.addEventListener("message", async (event) => {
//     try {
//       const message = JSON.parse(event.data);
      
//       console.log("Received message:", message.event);

//       switch (message.event) {
//         case 'connected':
//           console.log("Connected to Twilio Media Stream");
//           break;
          
//         case 'start':
//           callSid = message.start.callSid;
//           console.log(`Media stream started for call: ${callSid}`);
          
//           // Find the call record
//           const { data: callRecord } = await supabase
//             .from('calls')
//             .select('id')
//             .eq('twilio_call_sid', callSid)
//             .single();
            
//           if (callRecord) {
//             callId = callRecord.id;
//             console.log(`Found call record: ${callId}`);
            
//             // Connect directly to Deepgram
//             try {
//               const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2-phonecall&language=en&punctuate=true&interim_results=true&endpointing=300&utterance_end_ms=1000&smart_format=true`;
              
//               deepgramSocket = new WebSocket(deepgramUrl, ['token', DEEPGRAM_API_KEY || '']);
              
//               deepgramSocket.onopen = () => {
//                 console.log('Connected to Deepgram');
//               };
              
//               deepgramSocket.onmessage = async (dgEvent) => {
//                 try {
//                   const response = JSON.parse(dgEvent.data);
                  
//                   if (response.type === 'Results') {
//                     const transcript = response.channel?.alternatives?.[0];
                    
//                     if (transcript && transcript.transcript && transcript.transcript.trim()) {
//                       const text = transcript.transcript.trim();
//                       const isFinal = response.is_final;
//                       const confidence = transcript.confidence || 0;
                      
//                       // Only process high-confidence final transcripts
//                       if (isFinal && confidence > 0.7 && text.length > 2) {
//                         console.log(`Final transcript: ${text} (confidence: ${confidence})`);
                        
//                         // Determine speaker role based on track info
//                         // Twilio sends inbound track for customer, outbound for agent
//                         const role = 'customer'; // Default to customer for now
                        
//                         // Insert transcript into database
//                         const { data: insertedTranscript, error: insertError } = await supabase
//                           .from('transcripts')
//                           .insert({
//                             call_id: callId,
//                             text: text,
//                             role: role,
//                             created_at: new Date().toISOString()
//                           })
//                           .select()
//                           .single();
                          
//                         if (insertError) {
//                           console.error('Error inserting transcript:', insertError);
//                         } else {
//                           console.log(`Successfully inserted ${role} transcript:`, insertedTranscript);
                          
//                           // Generate AI suggestion for customer messages
//                           if (role === 'customer') {
//                             try {
//                               console.log('Generating AI suggestion for customer message:', text);
//                               const { data: suggestionData, error: suggestionError } = await supabase.functions.invoke('generate-suggestion', {
//                                 body: { callId, customerMessage: text }
//                               });
                              
//                               if (suggestionError) {
//                                 console.error('Error generating suggestion:', suggestionError);
//                               } else {
//                                 console.log('AI suggestion generated successfully:', suggestionData);
                                
//                                 // Insert the suggestion into the database
//                                 const { error: suggestionInsertError } = await supabase
//                                   .from('suggestions')
//                                   .insert({
//                                     call_id: callId,
//                                     text: suggestionData.suggestion,
//                                     created_at: new Date().toISOString()
//                                   });
                                  
//                                 if (suggestionInsertError) {
//                                   console.error('Error inserting suggestion to database:', suggestionInsertError);
//                                 } else {
//                                   console.log('Suggestion inserted to database successfully');
//                                 }
//                               }
//                             } catch (error) {
//                               console.error('Error calling generate-suggestion:', error);
//                             }
//                           }
//                         }
//                       }
//                     }
//                   } else if (response.type === 'Metadata') {
//                     console.log('Deepgram metadata:', response);
//                   }
//                 } catch (error) {
//                   console.error('Error processing Deepgram response:', error);
//                 }
//               };
              
//               deepgramSocket.onerror = (error) => {
//                 console.error('Deepgram WebSocket error:', error);
//               };
              
//               deepgramSocket.onclose = () => {
//                 console.log('Deepgram WebSocket closed');
//               };
              
//             } catch (error) {
//               console.error('Error connecting to Deepgram:', error);
//             }
//           }
//           break;
          
//         case 'media':
//           // Forward audio data directly to Deepgram
//           if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN && message.media) {
//             // Convert base64 audio to binary and send to Deepgram
//             try {
//               const audioData = Uint8Array.from(atob(message.media.payload), c => c.charCodeAt(0));
//               deepgramSocket.send(audioData);
//             } catch (error) {
//               console.error('Error processing audio data:', error);
//             }
//           }
//           break;
          
//         case 'stop':
//           console.log(`Media stream stopped for call: ${callSid}`);
//           if (deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
//             deepgramSocket.close();
//           }
//           break;
          
//         default:
//           console.log(`Unknown event: ${message.event}`);
//       }
//     } catch (error) {
//       console.error("Error processing message:", error);
//     }
//   });

//   socket.addEventListener("close", () => {
//     console.log(`WebSocket connection closed for call: ${callSid}`);
//     if (deepgramSocket) {
//       deepgramSocket.close();
//     }
//   });

//   socket.addEventListener("error", (error) => {
//     console.error("WebSocket error:", error);
//   });

//   return response;
// });


// supabase/functions/twilio-media-to-deepgram/index.ts
// Deno Edge Function: Twilio Media Streams → Deepgram Realtime → Supabase
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

serve(async (req) => {
  if (req.headers.get("upgrade") !== "websocket") {
    return new Response("Expected websocket", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY") ?? "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let callSid: string | null = null;
  let callId: string | null = null;
  let lastTrack: "inbound" | "outbound" | null = null;

  let dgSocket: WebSocket | null = null;
  let dgOpen = false;
  const pendingFrames: Uint8Array[] = [];

  const b64ToU8 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function connectDeepgram() {
    if (!DEEPGRAM_API_KEY) {
      console.error("❌ DEEPGRAM_API_KEY missing");
      return;
    }

    const dgUrl =
      "wss://api.deepgram.com/v1/listen?model=phonecall&encoding=mulaw&sample_rate=8000&punctuate=true&interim_results=true&smart_format=true&diarize=true&endpointing=300&utterance_end_ms=1000";

    try {
      // @ts-ignore WebSocketStream is in Deno
      const dgWss = new WebSocketStream(dgUrl, {
        headers: { Authorization: `Token ${DEEPGRAM_API_KEY}` },
      });
      const { socket: ws } = await dgWss.connection;
      dgSocket = ws;

      dgSocket.addEventListener("open", () => {
        dgOpen = true;
        console.log("✅ Connected to Deepgram");

        if (pendingFrames.length) {
          console.log(`▶️ Flushing ${pendingFrames.length} buffered frames to Deepgram`);
          for (const frame of pendingFrames) {
            try {
              dgSocket?.send(frame.buffer);
            } catch (e) {
              console.error("❌ Error sending buffered frame to Deepgram:", e);
            }
          }
          pendingFrames.length = 0;
        }
      });

      dgSocket.addEventListener("message", async (evt) => {
        try {
          const msg = JSON.parse(evt.data as string);
          console.log("📩 Deepgram message:", JSON.stringify(msg));

          if (msg.type === "Results") {
            const isFinal: boolean = !!msg.is_final;
            const alt = msg.channel?.alternatives?.[0];
            const text: string = (alt?.transcript ?? "").trim();
            const confidence: number = alt?.confidence ?? 0;

            if (!text) {
              console.log("ℹ️ Empty interim transcript ignored");
              return;
            }

            console.log(`📝 Transcript received | final=${isFinal} | conf=${confidence} | text="${text}"`);

            if (isFinal && confidence >= 0.5) {
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
            }
          }
        } catch (e) {
          console.error("❌ Error parsing Deepgram message:", e);
        }
      });

      dgSocket.addEventListener("close", () => {
        dgOpen = false;
        console.log("🔌 Deepgram WebSocket closed");
      });

      dgSocket.addEventListener("error", (e) => {
        console.error("❌ Deepgram WebSocket error:", e);
      });
    } catch (e) {
      console.error("❌ Failed to connect to Deepgram:", e);
    }
  }

  socket.addEventListener("open", () => {
    console.log("🌐 Twilio Media Streams WS opened");
  });

  socket.addEventListener("message", async (event) => {
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
            }
          }

          await connectDeepgram();
          break;
        }

        case "media": {
          const track = msg?.media?.track as "inbound" | "outbound" | undefined;
          if (track) {
            lastTrack = track;
            console.log(`🎙️ Media frame received from Twilio, track=${track}`);
          }

          const b64 = msg?.media?.payload as string | undefined;
          if (!b64) break;

          const frame = b64ToU8(b64);
          console.log(`📦 Audio frame size=${frame.length} bytes`);

          if (dgOpen && dgSocket?.readyState === WebSocket.OPEN) {
            try {
              dgSocket.send(frame.buffer);
              console.log("➡️ Sent audio frame to Deepgram");
            } catch (e) {
              console.error("❌ Error sending frame to Deepgram:", e);
            }
          } else {
            console.log("⏳ Deepgram not ready, buffering frame");
            pendingFrames.push(frame);
          }
          break;
        }

        case "stop":
          console.log("⏹️ Twilio stop for CallSid:", callSid);
          try {
            dgSocket?.close();
          } catch {}
          break;
      }
    } catch (e) {
      console.error("❌ Error processing Twilio message:", e);
    }
  });

  socket.addEventListener("close", () => {
    console.log("🔌 Twilio WS closed for CallSid:", callSid);
    try {
      dgSocket?.close();
    } catch {}
  });

  socket.addEventListener("error", (e) => {
    console.error("❌ Twilio WS error:", e);
  });

  return response;
});
