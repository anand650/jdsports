import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Transcript, Suggestion } from '@/types/call-center';

export const useRealtimeTranscripts = (callId: string | null) => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);

  useEffect(() => {
    if (!callId) {
      setTranscripts([]);
      return;
    }

    // Fetch existing transcripts
    const fetchTranscripts = async () => {
      const { data } = await supabase
        .from('transcripts')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: true });
      
      if (data) setTranscripts(data as Transcript[]);
    };

    fetchTranscripts();

    // Subscribe to new transcripts
    const channel = supabase
      .channel('transcript-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcripts',
          filter: `call_id=eq.${callId}`
        },
        (payload) => {
          const newTranscript = payload.new as Transcript;
          setTranscripts(prev => [...prev, newTranscript]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  return transcripts;
};

export const useRealtimeSuggestions = (callId: string | null) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!callId) {
      setSuggestions([]);
      return;
    }

    // Fetch existing suggestions (latest 3)
    const fetchSuggestions = async () => {
      const { data } = await supabase
        .from('suggestions')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (data) setSuggestions((data as Suggestion[]).reverse());
    };

    fetchSuggestions();

    // Subscribe to new suggestions
    const channel = supabase
      .channel('suggestion-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suggestions',
          filter: `call_id=eq.${callId}`
        },
        (payload) => {
          const newSuggestion = payload.new as Suggestion;
          setSuggestions(prev => {
            const updated = [...prev, newSuggestion];
            return updated.slice(-3); // Keep only latest 3
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  return suggestions;
};