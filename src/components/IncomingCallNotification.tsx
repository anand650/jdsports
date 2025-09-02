import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, User } from 'lucide-react';
import { Call } from '@/types/call-center';

interface IncomingCallNotificationProps {
  incomingCall: Call | null;
  onAnswer: (call: Call) => void;
  onDecline: (call: Call) => void;
}

export const IncomingCallNotification = ({ 
  incomingCall, 
  onAnswer, 
  onDecline 
}: IncomingCallNotificationProps) => {
  const [ringingDuration, setRingingDuration] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (incomingCall && (incomingCall.call_status === 'ringing' || incomingCall.call_status === 'in-progress')) {
      interval = setInterval(() => {
        setRingingDuration(prev => prev + 1);
      }, 1000);
    } else {
      setRingingDuration(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [incomingCall]);

  if (!incomingCall || (incomingCall.call_status === 'completed' || incomingCall.call_status === 'failed')) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-pulse">
      <Card className="w-80 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 shadow-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-green-800 flex items-center gap-2">
            <Phone className="h-5 w-5 animate-bounce" />
            Incoming Call
            <Badge variant="secondary" className="ml-auto">
              {Math.floor(ringingDuration / 60)}:{(ringingDuration % 60).toString().padStart(2, '0')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-full">
              <User className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {incomingCall.customer_number}
              </p>
              <p className="text-sm text-gray-600">
                {incomingCall.call_direction} call
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => {
                console.log('🔵 IncomingCallNotification Answer button clicked!');
                onAnswer(incomingCall);
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <Phone className="mr-2 h-4 w-4" />
              Answer
            </Button>
            <Button 
              onClick={() => onDecline(incomingCall)}
              variant="destructive"
              className="flex-1"
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};