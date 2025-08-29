import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Lightbulb, Copy, CheckCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Suggestion {
  id: string;
  text: string;
  created_at: string;
}

interface AISuggestionsPanelProps {
  callId: string | null;
}

export const AISuggestionsPanel = ({ callId }: AISuggestionsPanelProps) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [copiedSuggestions, setCopiedSuggestions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load existing suggestions when call starts
  useEffect(() => {
    if (!callId) {
      setSuggestions([]);
      return;
    }

    console.log('Loading suggestions for call ID:', callId);

    const loadSuggestions = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('suggestions')
          .select('*')
          .eq('call_id', callId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log('Loaded existing suggestions:', data?.length || 0, 'for call:', callId);
        setSuggestions(data || []);
      } catch (error) {
        console.error('Error loading suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSuggestions();

    // Subscribe to new suggestions with a unique channel name
    const channelName = `suggestions:${callId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suggestions',
          filter: `call_id=eq.${callId}`
        },
        (payload) => {
          console.log('New suggestion received via realtime:', payload.new);
          const newSuggestion = payload.new as Suggestion;
          setSuggestions(prev => {
            // Avoid duplicates
            if (prev.find(s => s.id === newSuggestion.id)) {
              return prev;
            }
            return [newSuggestion, ...prev];
          });
        }
      )
      .subscribe((status) => {
        console.log('Realtime suggestion subscription status:', status, 'for call:', callId);
      });

    return () => {
      console.log('Removing suggestion channel:', channelName);
      supabase.removeChannel(channel);
    };
  }, [callId]);

  const copySuggestion = async (suggestionId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSuggestions(prev => new Set([...prev, suggestionId]));
      
      toast({
        title: "Copied!",
        description: "Suggestion copied to clipboard",
      });

      // Remove the "copied" state after 2 seconds
      setTimeout(() => {
        setCopiedSuggestions(prev => {
          const newSet = new Set(prev);
          newSet.delete(suggestionId);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to copy suggestion",
        variant: "destructive",
      });
    }
  };


  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <Card className="h-[400px] max-h-[50vh] bg-sidebar border-sidebar-border flex flex-col">
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="text-sidebar-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Suggestions
          {callId && suggestions.length > 0 && (
            <Badge variant="default" className="ml-auto">
              {suggestions.length} suggestions
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        {!callId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Lightbulb className="h-12 w-12 text-sidebar-primary mb-4" />
            <p className="text-sidebar-foreground font-medium">
              No Active Call
            </p>
            <p className="text-sm text-sidebar-accent-foreground mt-2">
              AI suggestions will appear here during calls
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebar-primary"></div>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 text-sidebar-primary mx-auto mb-3" />
                <p className="text-sidebar-accent-foreground text-sm">
                  AI is analyzing the conversation...
                </p>
                <p className="text-sidebar-accent-foreground text-xs mt-1">
                  Suggestions will appear automatically as customers speak
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {suggestions.map((suggestion, index) => (
                  <div key={suggestion.id}>
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm text-gray-800 leading-relaxed">
                            {suggestion.text}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {formatTime(suggestion.created_at)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copySuggestion(suggestion.id, suggestion.text)}
                          className="flex-shrink-0 h-8 w-8 p-0"
                        >
                          {copiedSuggestions.has(suggestion.id) ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {index < suggestions.length - 1 && (
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