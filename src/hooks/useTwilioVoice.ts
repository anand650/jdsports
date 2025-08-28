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
    // Prevent multiple initialization attempts
    if (isInitializing) {
      console.log('Device initialization already in progress, skipping...');
      return;
    }

    setIsInitializing(true);

    try {
      console.log('Initializing Twilio device...');
      
      // Clean up existing device first
      if (deviceRef.current) {
        console.log('Destroying existing device...');
        deviceRef.current.destroy();
        deviceRef.current = null;
        setDevice(null);
        setIsDeviceReady(false);
      }
      
      // Get access token from Supabase edge function
      const { data, error } = await supabase.functions.invoke('twilio-access-token', {
        body: { identity: 'agent' }
      });

      console.log('Token response:', { data, error });

      if (error) {
        console.error('Token error:', error);
        throw error;
      }

      if (!data?.token) {
        throw new Error('No token received');
      }

      console.log('Creating Twilio device with token...');
      
      const twilioDevice = new Device(data.token, {
        logLevel: 1,
        allowIncomingWhileBusy: true,
        sounds: {
          incoming: undefined, // Disable incoming sound, we'll handle notifications in UI
        }
      });

      // Device event listeners
      twilioDevice.on('ready', () => {
        console.log('Twilio device ready');
        setIsDeviceReady(true);
        toast({
          title: "Voice Ready",
          description: "Twilio voice device is ready for calls",
        });
      });

      twilioDevice.on('error', (error) => {
        console.error('Twilio device error:', error);
        
        // Don't retry automatically to prevent infinite loops
        // Just notify the user and mark device as not ready
        setIsDeviceReady(false);
        
        toast({
          title: "Voice Connection Error",
          description: "Voice connection lost. Please refresh to reconnect.",
          variant: "destructive",
        });
      });

      twilioDevice.on('incoming', (call) => {
        console.log('Incoming call:', call);
        setActiveCall(call);
        
        // Set up call event listeners
        setupCallListeners(call);
      });

      twilioDevice.on('registered', () => {
        console.log('Device registered');
      });

      twilioDevice.on('unregistered', () => {
        console.log('Device unregistered');
        setIsDeviceReady(false);
      });

      console.log('Registering device...');
      await twilioDevice.register();
      console.log('Device registration complete');
      
      setDevice(twilioDevice);
      deviceRef.current = twilioDevice;

    } catch (error) {
      console.error('Error initializing Twilio device:', error);
      toast({
        title: "Initialization Error",
        description: `Failed to initialize voice device: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
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
    answerCall,
    rejectCall,
    hangupCall,
    toggleMute,
    toggleHold,
    makeCall,
  };
};