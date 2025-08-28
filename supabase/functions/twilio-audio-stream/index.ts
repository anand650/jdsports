import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let currentCallId: string | null = null;
  let audioBuffer: string[] = [];

  socket.onopen = () => {
    console.log('WebSocket connection opened for audio streaming');
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received audio stream event:', data.event);

      switch (data.event) {
        case 'connected':
          console.log('Twilio Media Stream connected');
          break;

        case 'start':
          currentCallId = data.start?.callSid;
          console.log('Stream started for call:', currentCallId);
          
          // Find call record and update status
          if (currentCallId) {
            await supabase
              .from('calls')
              .update({ 
                call_status: 'in-progress',
                started_at: new Date().toISOString()
              })
              .eq('twilio_call_sid', currentCallId);
          }
          break;

        case 'media':
          if (data.media?.payload) {
            audioBuffer.push(data.media.payload);
            
            // Process audio chunks every 2 seconds (approximately)
            if (audioBuffer.length >= 20) {
              await processAudioChunk(audioBuffer.join(''), currentCallId);
              audioBuffer = [];
            }
          }
          break;

        case 'stop':
          console.log('Stream stopped for call:', currentCallId);
          
          // Process remaining audio
          if (audioBuffer.length > 0 && currentCallId) {
            await processAudioChunk(audioBuffer.join(''), currentCallId);
            audioBuffer = [];
          }

          // Update call status
          if (currentCallId) {
            await supabase
              .from('calls')
              .update({ 
                call_status: 'completed',
                ended_at: new Date().toISOString()
              })
              .eq('twilio_call_sid', currentCallId);
          }
          break;
      }
    } catch (error) {
      console.error('Error processing audio stream:', error);
    }
  };

  async function processAudioChunk(audioPayload: string, callSid: string | null) {
    if (!callSid) return;

    try {
      // Find call record
      const { data: callRecord } = await supabase
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .single();

      if (!callRecord) return;

      // Convert base64 audio to binary for transcription
      const binaryAudio = atob(audioPayload);
      const audioBytes = new Uint8Array(binaryAudio.length);
      
      for (let i = 0; i < binaryAudio.length; i++) {
        audioBytes[i] = binaryAudio.charCodeAt(i);
      }

      // Create audio blob for OpenAI Whisper
      const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      // Send to OpenAI for transcription
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        },
        body: formData,
      });

      if (response.ok) {
        const transcriptionResult = await response.json();
        
        if (transcriptionResult.text && transcriptionResult.text.trim()) {
          // Save transcript to database
          await supabase
            .from('transcripts')
            .insert({
              call_id: callRecord.id,
              role: 'customer', // Assuming incoming audio is from customer
              text: transcriptionResult.text,
              created_at: new Date().toISOString()
            });

          // Generate AI suggestions
          await supabase.functions.invoke('generate-suggestion', {
            body: {
              callId: callRecord.id,
              customerMessage: transcriptionResult.text
            }
          });
        }
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  socket.onclose = () => {
    console.log('WebSocket connection closed');
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});