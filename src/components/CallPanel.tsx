import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from 'lucide-react';
import { Call } from '@/types/call-center';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface CallPanelProps {
  activeCall: Call | null;
  onAnswerCall: () => void;
  onEndCall: () => void;
}

export const CallPanel = ({ activeCall, onAnswerCall, onEndCall }: CallPanelProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const { toast } = useToast();

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswer = async () => {
    setIsConnected(true);
    setCallDuration(0);
    onAnswerCall();
  };

  const handleEnd = async () => {
    if (activeCall?.twilio_call_sid) {
      try {
        await supabase.functions.invoke('twilio-call-controls', {
          body: {
            action: 'hangup',
            callSid: activeCall.twilio_call_sid
          }
        });
      } catch (error) {
        console.error('Error ending call:', error);
        toast({
          title: "Error",
          description: "Failed to end call",
          variant: "destructive",
        });
      }
    }
    
    setIsConnected(false);
    setIsMuted(false);
    setIsOnHold(false);
    setCallDuration(0);
    onEndCall();
  };

  const toggleMute = async () => {
    if (!activeCall?.twilio_conference_sid) return;
    
    try {
      await supabase.functions.invoke('twilio-call-controls', {
        body: {
          action: isMuted ? 'unmute' : 'mute',
          conferenceSid: activeCall.twilio_conference_sid,
          participantSid: 'agent' // You'll need to track the actual participant SID
        }
      });
      
      setIsMuted(!isMuted);
      toast({
        title: isMuted ? "Unmuted" : "Muted",
        description: `Call has been ${isMuted ? 'unmuted' : 'muted'}`,
      });
    } catch (error) {
      console.error('Error toggling mute:', error);
      toast({
        title: "Error",
        description: "Failed to toggle mute",
        variant: "destructive",
      });
    }
  };

  const toggleHold = async () => {
    if (!activeCall?.twilio_conference_sid) return;
    
    try {
      await supabase.functions.invoke('twilio-call-controls', {
        body: {
          action: isOnHold ? 'unhold' : 'hold',
          conferenceSid: activeCall.twilio_conference_sid,
          participantSid: 'agent'
        }
      });
      
      setIsOnHold(!isOnHold);
      toast({
        title: isOnHold ? "Resumed" : "On Hold",
        description: `Call has been ${isOnHold ? 'resumed' : 'put on hold'}`,
      });
    } catch (error) {
      console.error('Error toggling hold:', error);
      toast({
        title: "Error",
        description: "Failed to toggle hold",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="h-full bg-sidebar border-sidebar-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-sidebar-foreground flex items-center justify-between">
          Call Control
          {activeCall && (
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Incoming"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeCall ? (
          <>
            <div className="bg-sidebar-accent p-4 rounded-lg">
              <p className="text-sm font-medium text-sidebar-accent-foreground">
                Customer Number
              </p>
              <p className="text-lg font-mono text-sidebar-foreground">
                {activeCall.customer_number}
              </p>
            </div>
            
            <div className="bg-sidebar-accent p-4 rounded-lg">
              <p className="text-sm font-medium text-sidebar-accent-foreground">
                Call Duration
              </p>
              <p className="text-lg font-mono text-sidebar-foreground">
                {isConnected ? formatDuration(callDuration) : "Waiting..."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {!isConnected ? (
                <Button 
                  onClick={handleAnswer} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Answer Call
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={toggleMute} 
                      variant={isMuted ? "destructive" : "secondary"}
                      size="sm"
                    >
                      {isMuted ? (
                        <MicOff className="mr-1 h-3 w-3" />
                      ) : (
                        <Mic className="mr-1 h-3 w-3" />
                      )}
                      {isMuted ? "Unmute" : "Mute"}
                    </Button>
                    <Button 
                      onClick={toggleHold} 
                      variant={isOnHold ? "destructive" : "secondary"}
                      size="sm"
                    >
                      {isOnHold ? (
                        <Play className="mr-1 h-3 w-3" />
                      ) : (
                        <Pause className="mr-1 h-3 w-3" />
                      )}
                      {isOnHold ? "Resume" : "Hold"}
                    </Button>
                  </div>
                  <Button 
                    onClick={handleEnd} 
                    variant="destructive"
                    className="w-full"
                  >
                    <PhoneOff className="mr-2 h-4 w-4" />
                    End Call
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Phone className="mx-auto h-12 w-12 text-sidebar-primary mb-4" />
            <p className="text-sidebar-foreground font-medium">
              No Active Call
            </p>
            <p className="text-sm text-sidebar-accent-foreground mt-2">
              Waiting for incoming calls from Twilio
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};