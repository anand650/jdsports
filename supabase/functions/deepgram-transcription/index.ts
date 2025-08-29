import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY');

// Track active WebSocket connections
const activeConnections = new Map();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let deepgramSocket: WebSocket | null = null;
  let callId: string | null = null;
  let lastTranscriptTime = 0;
  let transcriptBuffer = '';

  socket.onopen = () => {
    console.log('Client WebSocket connected');
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.event === 'start') {
        callId = message.callId;
        console.log(`Starting Deepgram transcription for call: ${callId}`);
        
        // Initialize Deepgram WebSocket connection
        const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2-phonecall&language=en&punctuate=true&interim_results=true&endpointing=300&utterance_end_ms=1000&smart_format=true`;
        
        deepgramSocket = new WebSocket(deepgramUrl, ['token', DEEPGRAM_API_KEY || '']);
        
        deepgramSocket.onopen = () => {
          console.log('Connected to Deepgram');
          socket.send(JSON.stringify({ type: 'status', message: 'Connected to transcription service' }));
        };
        
        deepgramSocket.onmessage = async (dgEvent) => {
          try {
            const response = JSON.parse(dgEvent.data);
            
            if (response.type === 'Results') {
              const transcript = response.channel?.alternatives?.[0];
              
              if (transcript && transcript.transcript && transcript.transcript.trim()) {
                const text = transcript.transcript.trim();
                const isFinal = response.is_final;
                const confidence = transcript.confidence || 0;
                
                // Only process high-confidence final transcripts
                if (isFinal && confidence > 0.7 && text.length > 2) {
                  console.log(`Final transcript: ${text} (confidence: ${confidence})`);
                  
                  // Determine speaker role based on channel or track info
                  const role = message.track === 'inbound' ? 'customer' : 'agent';
                  
                  // Insert transcript into database
                  const { error: insertError } = await supabase
                    .from('transcripts')
                    .insert({
                      call_id: callId,
                      text: text,
                      role: role,
                      created_at: new Date().toISOString()
                    });
                    
                  if (insertError) {
                    console.error('Error inserting transcript:', insertError);
                  } else {
                    console.log(`Inserted ${role} transcript: ${text}`);
                    
                    // Generate AI suggestion for customer messages
                    if (role === 'customer') {
                      try {
                        const { error: suggestionError } = await supabase.functions.invoke('generate-suggestion', {
                          body: { callId, customerMessage: text }
                        });
                        
                        if (suggestionError) {
                          console.error('Error generating suggestion:', suggestionError);
                        }
                      } catch (error) {
                        console.error('Error calling generate-suggestion:', error);
                      }
                    }
                  }
                  
                  // Send transcript to client
                  socket.send(JSON.stringify({
                    type: 'transcript',
                    text: text,
                    role: role,
                    confidence: confidence,
                    timestamp: new Date().toISOString()
                  }));
                }
              }
            } else if (response.type === 'Metadata') {
              console.log('Deepgram metadata:', response);
            }
          } catch (error) {
            console.error('Error processing Deepgram response:', error);
          }
        };
        
        deepgramSocket.onerror = (error) => {
          console.error('Deepgram WebSocket error:', error);
          socket.send(JSON.stringify({ type: 'error', message: 'Transcription service error' }));
        };
        
        deepgramSocket.onclose = () => {
          console.log('Deepgram WebSocket closed');
        };
        
      } else if (message.event === 'media' && deepgramSocket && deepgramSocket.readyState === WebSocket.OPEN) {
        // Forward audio data to Deepgram
        // Convert base64 to binary and send to Deepgram
        const audioData = Uint8Array.from(atob(message.media.payload), c => c.charCodeAt(0));
        deepgramSocket.send(audioData);
        
      } else if (message.event === 'stop') {
        console.log(`Stopping transcription for call: ${callId}`);
        if (deepgramSocket) {
          deepgramSocket.close();
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  };

  socket.onclose = () => {
    console.log('Client WebSocket closed');
    if (deepgramSocket) {
      deepgramSocket.close();
    }
    if (callId) {
      activeConnections.delete(callId);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (deepgramSocket) {
      deepgramSocket.close();
    }
  };

  return response;
});