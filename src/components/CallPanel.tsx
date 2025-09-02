import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play } from 'lucide-react';
import { Call } from '@/types/call-center';
import { useTwilioVoice } from '@/hooks/useTwilioVoice';

interface CallPanelProps {
  activeCall: Call | null;
  incomingCall: Call | null;
  onAnswerCall: (call?: Call) => void;
  onEndCall: () => void;
}

export const CallPanel = ({ activeCall: dbCall, incomingCall, onAnswerCall, onEndCall }: CallPanelProps) => {
  const [callDuration, setCallDuration] = useState(0);
  
  const {
    activeCall: twilioCall,
    isConnected,
    isMuted,
    isOnHold,
    isDeviceReady,
    isInitializing,
    answerCall,
    rejectCall,
    hangupCall,
    toggleMute,
    toggleHold,
    retryConnection,
  } = useTwilioVoice();

  // Timer for call duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isConnected) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
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

  const handleAnswer = () => {
    console.log('🔵 CallPanel Answer button clicked!');
    console.log('🔵 CallPanel dbCall:', dbCall?.id, 'incomingCall:', incomingCall?.id);
    
    const callToAnswer = dbCall || incomingCall;
    console.log('🔵 CallPanel callToAnswer:', callToAnswer?.id, 'status:', callToAnswer?.call_status);
    
    answerCall();
    
    if (callToAnswer) {
      console.log('🔵 CallPanel calling onAnswerCall with:', callToAnswer.id);
      onAnswerCall(callToAnswer);
    } else {
      console.error('❌ CallPanel: No call to answer (neither dbCall nor incomingCall)');
      onAnswerCall();
    }
  };

  const handleEnd = () => {
    hangupCall();
    onEndCall();
  };

  const handleReject = () => {
    rejectCall();
    onEndCall();
  };

  const getCallStatus = () => {
    if (!isDeviceReady) return "Initializing...";
    if (twilioCall && !isConnected) return "Incoming";
    if (isConnected) return "Connected";
    if (dbCall && !twilioCall) return "Waiting";
    return "Ready";
  };

  const getStatusBadgeVariant = (): "secondary" | "default" | "destructive" | "outline" => {
    if (!isDeviceReady) return "secondary";
    if (isConnected) return "default";
    if (twilioCall || dbCall) return "destructive";
    return "secondary";
  };

  return (
    <Card className="h-full bg-sidebar border-sidebar-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-sidebar-foreground flex items-center justify-between">
          Call Control
          <Badge variant={getStatusBadgeVariant()}>
            {getCallStatus()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(dbCall || incomingCall || twilioCall) ? (
          <>
            <div className="bg-sidebar-accent p-4 rounded-lg">
              <p className="text-sm font-medium text-sidebar-accent-foreground">
                Customer Number
              </p>
              <p className="text-lg font-mono text-sidebar-foreground">
                {(dbCall || incomingCall)?.customer_number || 'Unknown'}
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
              {!isConnected && twilioCall ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={handleAnswer} 
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Answer
                  </Button>
                  <Button 
                    onClick={handleReject} 
                    variant="destructive"
                  >
                    <PhoneOff className="mr-2 h-4 w-4" />
                    Decline
                  </Button>
                </div>
              ) : isConnected ? (
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
              ) : (dbCall || incomingCall) && !twilioCall ? (
                <Button 
                  onClick={handleAnswer} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={!isDeviceReady}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  {isDeviceReady ? "Answer Call" : "Initializing..."}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Phone className="mx-auto h-12 w-12 text-sidebar-primary mb-4" />
            <p className="text-sidebar-foreground font-medium">
              {isDeviceReady ? "Ready for Calls" : isInitializing ? "Connecting..." : "Connection Failed"}
            </p>
            <p className="text-sm text-sidebar-accent-foreground mt-2">
              {isDeviceReady 
                ? "Waiting for incoming calls" 
                : isInitializing 
                  ? "Setting up Twilio voice device" 
                  : "Unable to connect to voice service"
              }
            </p>
            {!isDeviceReady && !isInitializing && (
              <button 
                onClick={retryConnection}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};