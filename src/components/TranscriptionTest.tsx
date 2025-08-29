import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeTranscripts, useRealtimeSuggestions } from '@/hooks/useRealtimeSubscriptions';
import { useToast } from '@/components/ui/use-toast';
import { Mic, MicOff, TestTube } from 'lucide-react';

export const TranscriptionTest = () => {
  const [isTestingActive, setIsTestingActive] = useState(false);
  const [testCallId, setTestCallId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const transcripts = useRealtimeTranscripts(testCallId);
  const suggestions = useRealtimeSuggestions(testCallId);

  const createTestCall = async () => {
    try {
      const { data: callData, error } = await supabase
        .from('calls')
        .insert({
          customer_number: '+1-555-TEST',
          call_status: 'in-progress',
          call_direction: 'inbound',
          agent_id: '12345',
          twilio_call_sid: `test_${Date.now()}`
        })
        .select()
        .single();

      if (error) throw error;
      
      setTestCallId(callData.id);
      setIsTestingActive(true);
      
      toast({
        title: "Test Call Created",
        description: `Test call ID: ${callData.id}`,
      });
    } catch (error) {
      console.error('Error creating test call:', error);
      toast({
        title: "Error",
        description: "Failed to create test call",
        variant: "destructive"
      });
    }
  };

  const addTestTranscript = async (role: 'customer' | 'agent', text: string) => {
    if (!testCallId) return;

    try {
      const { error } = await supabase
        .from('transcripts')
        .insert({
          call_id: testCallId,
          role,
          text,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      toast({
        title: "Test Transcript Added",
        description: `${role}: ${text}`,
      });
    } catch (error) {
      console.error('Error adding transcript:', error);
      toast({
        title: "Error",
        description: "Failed to add transcript",
        variant: "destructive"
      });
    }
  };

  const endTest = async () => {
    if (!testCallId) return;
    
    try {
      await supabase
        .from('calls')
        .update({ call_status: 'completed' })
        .eq('id', testCallId);
      
      setIsTestingActive(false);
      setTestCallId(null);
      
      toast({
        title: "Test Ended",
        description: "Test call completed",
      });
    } catch (error) {
      console.error('Error ending test:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Transcription System Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {!isTestingActive ? (
              <Button onClick={createTestCall} className="flex items-center gap-2">
                <Mic className="h-4 w-4" />
                Start Test Call
              </Button>
            ) : (
              <>
                <Badge variant="secondary">Test Active - Call ID: {testCallId}</Badge>
                <Button onClick={endTest} variant="destructive" className="flex items-center gap-2">
                  <MicOff className="h-4 w-4" />
                  End Test
                </Button>
              </>
            )}
          </div>

          {isTestingActive && (
            <div className="flex gap-2">
              <Button 
                onClick={() => addTestTranscript('customer', 'Hello, I need help with my order')}
                variant="outline"
              >
                Add Customer Message
              </Button>
              <Button 
                onClick={() => addTestTranscript('agent', 'I can help you with that. Can you provide your order number?')}
                variant="outline"
              >
                Add Agent Response
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Transcripts ({transcripts.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {transcripts.length === 0 ? (
              <p className="text-muted-foreground">No transcripts yet...</p>
            ) : (
              transcripts.map((transcript, index) => (
                <div key={transcript.id} className="p-2 rounded border">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={transcript.role === 'customer' ? 'default' : 'secondary'}>
                      {transcript.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(transcript.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{transcript.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Suggestions ({suggestions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {suggestions.length === 0 ? (
              <p className="text-muted-foreground">No suggestions yet...</p>
            ) : (
              suggestions.map((suggestion, index) => (
                <div key={suggestion.id} className="p-2 rounded border bg-accent/50">
                  <div className="text-xs text-muted-foreground mb-1">
                    {new Date(suggestion.created_at).toLocaleTimeString()}
                  </div>
                  <p className="text-sm">{suggestion.text}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};