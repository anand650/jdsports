import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Call } from '@/types/call-center';

interface CallPanelProps {
  activeCall: Call | null;
  onAnswerCall: () => void;
  onEndCall: () => void;
}

export const CallPanel = ({ activeCall, onAnswerCall, onEndCall }: CallPanelProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleAnswer = () => {
    setIsConnected(true);
    onAnswerCall();
  };

  const handleEnd = () => {
    setIsConnected(false);
    setIsMuted(false);
    onEndCall();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
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
                {isConnected ? "00:45" : "Waiting..."}
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
                  <Button 
                    onClick={toggleMute} 
                    variant={isMuted ? "destructive" : "secondary"}
                    className="w-full"
                  >
                    {isMuted ? (
                      <MicOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Mic className="mr-2 h-4 w-4" />
                    )}
                    {isMuted ? "Unmute" : "Mute"}
                  </Button>
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
              Waiting for incoming calls from VAPI
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};