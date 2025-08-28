import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { CallPanel } from './CallPanel';
import { LiveTranscriptPanel } from './LiveTranscriptPanel';
import { AISuggestionsPanel } from './AISuggestionsPanel';
import { CustomerInfoPanel } from './CustomerInfoPanel';
import { IncomingCallNotification } from './IncomingCallNotification';
import { Call, CustomerProfile } from '@/types/call-center';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const CallCenterLayout = () => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const { toast } = useToast();

  // Subscribe to incoming calls and call updates
  useEffect(() => {
    const channel = supabase
      .channel('call-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          const newCall = payload.new as Call;
          if (newCall.call_status === 'ringing' && newCall.call_direction === 'inbound') {
            setIncomingCall(newCall);
            toast({
              title: "Incoming Call",
              description: `Call from ${newCall.customer_number}`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          const updatedCall = payload.new as Call;
          if (activeCall && updatedCall.id === activeCall.id) {
            setActiveCall(updatedCall);
          }
          if (incomingCall && updatedCall.id === incomingCall.id) {
            if (updatedCall.call_status !== 'ringing') {
              setIncomingCall(null);
            } else {
              setIncomingCall(updatedCall);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCall, incomingCall, toast]);

  const handleAnswerCall = async (call?: Call) => {
    const callToAnswer = call || incomingCall;
    if (!callToAnswer) return;
    
    setActiveCall(callToAnswer);
    setIncomingCall(null);
    
    // Update call status to in-progress
    try {
      await supabase
        .from('calls')
        .update({ call_status: 'in-progress' })
        .eq('id', callToAnswer.id);
      
      toast({
        title: "Call Connected",
        description: `Connected to ${callToAnswer.customer_number}`,
      });

      // Load customer profile if available
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('phone_number', callToAnswer.customer_number)
        .single();
      
      if (profile) {
        setCustomerProfile(profile);
      }
    } catch (error) {
      console.error('Error answering call:', error);
      toast({
        title: "Error",
        description: "Failed to answer call",
        variant: "destructive",
      });
    }
  };

  const handleDeclineCall = async (call: Call) => {
    setIncomingCall(null);
    
    try {
      await supabase
        .from('calls')
        .update({ 
          call_status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('id', call.id);
    } catch (error) {
      console.error('Error declining call:', error);
    }
  };

  const handleEndCall = async () => {
    if (!activeCall) return;

    try {
      await supabase
        .from('calls')
        .update({ 
          call_status: 'completed',
          ended_at: new Date().toISOString() 
        })
        .eq('id', activeCall.id);

      toast({
        title: "Call Ended",
        description: "Call has been terminated",
      });

      setActiveCall(null);
      setCustomerProfile(null);
    } catch (error) {
      console.error('Error ending call:', error);
      toast({
        title: "Error",
        description: "Failed to end call",
        variant: "destructive",
      });
    }
  };

  // Simulate incoming call (for demo purposes)
  const simulateIncomingCall = async () => {
    try {
      const { data, error } = await supabase
        .from('calls')
        .insert({
          customer_number: '+1-555-' + Math.floor(Math.random() * 9000 + 1000),
          agent_id: null, // Will be assigned when answered
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setActiveCall(data);
        toast({
          title: "Incoming Call",
          description: `Call from ${data.customer_number}`,
        });
      }
    } catch (error) {
      console.error('Error creating call:', error);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        {/* Incoming Call Notification */}
        <IncomingCallNotification
          incomingCall={incomingCall}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
        />

        {/* Header with trigger */}
        <header className="absolute top-0 left-0 right-0 h-12 flex items-center border-b bg-background z-10">
          <SidebarTrigger className="ml-2" />
          <div className="flex-1 text-center">
            <h1 className="text-lg font-semibold">Call Center Dashboard</h1>
          </div>
          <button 
            onClick={simulateIncomingCall}
            className="mr-4 text-sm px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Simulate Call
          </button>
        </header>

        {/* Sidebar - Call Panel */}
        <aside className="w-80 border-r bg-sidebar pt-12">
          <div className="p-4 h-full">
            <CallPanel
              activeCall={activeCall}
              onAnswerCall={handleAnswerCall}
              onEndCall={handleEndCall}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 pt-12">
          <div className="h-[calc(100vh-3rem)] p-4 flex flex-col gap-4">
            <div className="flex gap-4 h-full">
              {/* Left Side - Transcript and Suggestions */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex-1">
                  <LiveTranscriptPanel callId={activeCall?.id || null} />
                </div>
                <div className="flex-1">
                  <AISuggestionsPanel callId={activeCall?.id || null} />
                </div>
              </div>
              
              {/* Right Side - Customer Info */}
              <div className="w-80">
                <CustomerInfoPanel 
                  customerProfile={customerProfile}
                  activeCall={activeCall}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};