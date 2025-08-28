import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { CallPanel } from './CallPanel';
import { TranscriptPanel } from './TranscriptPanel';
import { SuggestionsPanel } from './SuggestionsPanel';
import { CustomerInfoPanel } from './CustomerInfoPanel';
import { useRealtimeTranscripts, useRealtimeSuggestions } from '@/hooks/useRealtimeSubscriptions';
import { Call, CustomerProfile } from '@/types/call-center';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const CallCenterLayout = () => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const { toast } = useToast();
  
  // Real-time data subscriptions
  const transcripts = useRealtimeTranscripts(activeCall?.id || null);
  const suggestions = useRealtimeSuggestions(activeCall?.id || null);

  const handleAnswerCall = async () => {
    if (!activeCall) return;
    
    toast({
      title: "Call Connected",
      description: `Connected to ${activeCall.customer_number}`,
    });
  };

  const handleEndCall = async () => {
    if (!activeCall) return;

    try {
      // Update call with end time
      await supabase
        .from('calls')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', activeCall.id);

      toast({
        title: "Call Ended",
        description: "Call has been terminated",
      });

      setActiveCall(null);
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
                  <TranscriptPanel transcripts={transcripts} />
                </div>
                <div className="flex-1">
                  <SuggestionsPanel suggestions={suggestions} />
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