import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Transcript } from '@/types/call-center';

interface TranscriptPanelProps {
  transcripts: Transcript[];
}

export const TranscriptPanel = ({ transcripts }: TranscriptPanelProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new transcripts arrive
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [transcripts]);

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          Live Transcript
          <Badge variant="outline">
            {transcripts.length} messages
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full px-6 pb-6" ref={scrollAreaRef}>
          {transcripts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p>Conversation transcript will appear here...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className={`flex ${
                    transcript.role === 'agent' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      transcript.role === 'agent'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={transcript.role === 'agent' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {transcript.role === 'agent' ? 'Agent' : 'Customer'}
                      </Badge>
                      <span className="text-xs opacity-70">
                        {new Date(transcript.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{transcript.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};