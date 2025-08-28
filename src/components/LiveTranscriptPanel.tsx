import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, User, Headphones } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Transcript {
  id: string;
  role: string;
  text: string;
  created_at: string;
}

interface LiveTranscriptPanelProps {
  callId: string | null;
}

export const LiveTranscriptPanel = ({ callId }: LiveTranscriptPanelProps) => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Load existing transcripts when call starts
  useEffect(() => {
    if (!callId) {
      setTranscripts([]);
      return;
    }

    const loadTranscripts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('transcripts')
          .select('*')
          .eq('call_id', callId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setTranscripts(data || []);
      } catch (error) {
        console.error('Error loading transcripts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranscripts();

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

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="h-full bg-sidebar border-sidebar-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-sidebar-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Live Transcription
          {callId && (
            <Badge variant="default" className="ml-auto">
              {transcripts.length} messages
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-80px)]">
        {!callId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Headphones className="h-12 w-12 text-sidebar-primary mb-4" />
            <p className="text-sidebar-foreground font-medium">
              No Active Call
            </p>
            <p className="text-sm text-sidebar-accent-foreground mt-2">
              Start a call to see live transcription
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebar-primary"></div>
              </div>
            ) : transcripts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sidebar-accent-foreground text-sm">
                  Waiting for audio to transcribe...
                </p>
              </div>
            ) : (
              <div className="space-y-4 pb-4" ref={scrollRef}>
                {transcripts.map((transcript, index) => (
                  <div key={transcript.id}>
                    <div className={`flex gap-3 ${
                      transcript.role === 'agent' ? 'flex-row-reverse' : ''
                    }`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        transcript.role === 'customer' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {transcript.role === 'customer' ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Headphones className="h-4 w-4" />
                        )}
                      </div>
                      <div className={`flex-1 ${
                        transcript.role === 'agent' ? 'text-right' : 'text-left'
                      }`}>
                        <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                          transcript.role === 'customer'
                            ? 'bg-blue-50 text-blue-900'
                            : 'bg-green-50 text-green-900'
                        }`}>
                          <p className="text-sm">{transcript.text}</p>
                        </div>
                        <p className="text-xs text-sidebar-accent-foreground mt-1">
                          {formatTime(transcript.created_at)} • {transcript.role}
                        </p>
                      </div>
                    </div>
                    {index < transcripts.length - 1 && (
                      <Separator className="my-3" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};