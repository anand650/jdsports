import { useState, useEffect, useRef } from 'react';
import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTwilioVoice = () => {
  const [device, setDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    console.log('useTwilioVoice: useEffect triggered');
    initializeDevice();
    
    return () => {
      console.log('useTwilioVoice: cleanup function called');
      if (deviceRef.current) {
        console.log('Cleaning up Twilio device...');
        deviceRef.current.destroy();
        deviceRef.current = null;
      }
    };
  }, []);

  const initializeDevice = async () => {
    // TEMPORARILY DISABLE TWILIO DEVICE TO STOP INFINITE ERRORS
    console.log('Twilio Device initialization disabled to prevent infinite errors');
    console.log('Will implement proper connection handling after cleanup');
    setIsInitializing(false);
    setIsDeviceReady(false);
    return;
  };

  const setupCallListeners = (call: Call) => {
    call.on('accept', () => {
      console.log('Call accepted');
      setIsConnected(true);
      setActiveCall(call);
    });

    call.on('disconnect', () => {
      console.log('Call disconnected');
      setIsConnected(false);
      setActiveCall(null);
      setIsMuted(false);
      setIsOnHold(false);
    });

    call.on('cancel', () => {
      console.log('Call cancelled');
      setActiveCall(null);
    });

    call.on('reject', () => {
      console.log('Call rejected');
      setActiveCall(null);
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      toast({
        title: "Call Error",
        description: error.message,
        variant: "destructive",
      });
    });

    call.on('mute', (muted) => {
      console.log('Call mute status:', muted);
      setIsMuted(muted);
    });
  };

  const answerCall = () => {
    if (activeCall) {
      activeCall.accept();
    }
  };

  const rejectCall = () => {
    if (activeCall) {
      activeCall.reject();
      setActiveCall(null);
    }
  };

  const hangupCall = () => {
    if (activeCall) {
      activeCall.disconnect();
      
      // Also trigger our backend to end the call properly
      // This will be handled by the CallCenterLayout component
    }
  };

  const toggleMute = () => {
    if (activeCall) {
      activeCall.mute(!isMuted);
    }
  };

  const toggleHold = () => {
    if (activeCall) {
      // Twilio Voice SDK doesn't have built-in hold, we simulate with mute
      activeCall.mute(!isOnHold);
      setIsOnHold(!isOnHold);
      
      toast({
        title: isOnHold ? "Call Resumed" : "Call On Hold",
        description: `Call has been ${isOnHold ? 'resumed' : 'put on hold'}`,
      });
    }
  };

  const makeCall = async (to: string) => {
    if (device && isDeviceReady) {
      try {
        const call = await device.connect({
          params: {
            To: to,
          }
        });
        
        setActiveCall(call);
        setupCallListeners(call);
        
      } catch (error) {
        console.error('Error making call:', error);
        toast({
          title: "Call Failed",
          description: "Failed to make outgoing call",
          variant: "destructive",
        });
      }
    }
  };

  return {
    device,
    activeCall,
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
    makeCall,
    retryConnection: initializeDevice, // Manual retry function
  };
};