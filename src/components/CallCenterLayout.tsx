import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { CallPanel } from './CallPanel';
import { LiveTranscriptPanel } from './LiveTranscriptPanel';
import { AISuggestionsPanel } from './AISuggestionsPanel';
import { CallHistory } from './CallHistory';
import { CustomerInfoPanel } from './CustomerInfoPanel';
import { EnhancedCustomerInfoPanel } from './EnhancedCustomerInfoPanel';
import { CustomerChatHistory } from './CustomerChatHistory';
import { CallDetailsModal } from './CallDetailsModal';
import { IncomingCallNotification } from './IncomingCallNotification';
import { Call, CustomerProfile } from '@/types/call-center';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CallCenterLayoutProps {
  showHeader?: boolean;
}

export const CallCenterLayout = ({ showHeader = true }: CallCenterLayoutProps) => {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isCallDetailsOpen, setIsCallDetailsOpen] = useState(false);
  const { toast } = useToast();

  // Debug active call changes
  useEffect(() => {
    console.log('🏢 CallCenterLayout - activeCall changed:', {
      id: activeCall?.id,
      status: activeCall?.call_status,
      agentId: activeCall?.agent_id,
      customerNumber: activeCall?.customer_number
    });
  }, [activeCall]);

  console.log('🏢 CallCenterLayout rendered - activeCall:', activeCall?.id, 'status:', activeCall?.call_status);

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
          console.log('🔔 New call inserted:', newCall);
          
          // Show incoming call notification for calls that need an agent
          // (ringing calls or calls without an assigned agent)
          if (newCall.call_direction === 'inbound' && 
              (newCall.call_status === 'ringing' || 
               (newCall.call_status === 'in-progress' && !newCall.agent_id))) {
            console.log('🔔 Setting incoming call state:', newCall);
            setIncomingCall(newCall);
            toast({
              title: "Incoming Call",
              description: `Call from ${newCall.customer_number}`,
            });
          } else {
            console.log('🔔 Call not shown as incoming:', {
              direction: newCall.call_direction,
              status: newCall.call_status,
              agent: newCall.agent_id
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
          console.log('📞 Call history change: UPDATE');
          console.log('📞 Call updated:', payload.new);
          const updatedCall = payload.new as Call;
          
          // Update active call if it matches
          if (activeCall && updatedCall.id === activeCall.id) {
            console.log('🔄 Updating activeCall state with:', updatedCall);
            setActiveCall(updatedCall);
          }
          
          // Handle incoming call status changes
          if (incomingCall && updatedCall.id === incomingCall.id) {
            console.log('🔄 Processing incoming call update:', updatedCall.call_status);
            // Only hide incoming call if it's completed, failed, or has been assigned to an agent
            if (updatedCall.call_status === 'completed' || 
                updatedCall.call_status === 'failed' ||
                (updatedCall.agent_id && updatedCall.agent_id !== null)) {
              console.log('🔄 Hiding incoming call notification');
              setIncomingCall(null);
            } else {
              console.log('🔄 Updating incoming call state');
              setIncomingCall(updatedCall);
            }
          }
          
          // If this is a call that just got answered (status changed to in-progress), set as active
          if (updatedCall.call_status === 'in-progress' && 
              updatedCall.agent_id && 
              !activeCall) {
            console.log('🎯 Setting newly answered call as active:', updatedCall.id);
            setActiveCall(updatedCall);
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCall, incomingCall, toast]);

  const handleAnswerCall = async (call?: Call) => {
    console.log('🔧 *** handleAnswerCall TRIGGERED ***');
    console.log('🔧 handleAnswerCall called with:', call?.id || 'no call provided');
    console.log('🔧 incomingCall state:', incomingCall?.id || 'no incoming call');
    
    const callToAnswer = call || incomingCall;
    if (!callToAnswer) {
      console.error('❌ No call to answer');
      return;
    }
    
    console.log('📞 Answering call:', callToAnswer.id, 'status:', callToAnswer.call_status);
    
    try {
      // First update the call status and assign agent
      console.log('🔄 Updating call in database...');
      const { data: updatedCall, error: updateError } = await supabase
        .from('calls')
        .update({ 
          call_status: 'in-progress',
          agent_id: 'c8b54dd2-5c0c-4a49-8433-fe5957f34718', // Fixed agent ID for now
          started_at: new Date().toISOString() // Ensure started_at is set
        })
        .eq('id', callToAnswer.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }
      
      if (!updatedCall) {
        console.error('❌ No updated call data returned');
        throw new Error('Failed to get updated call data');
      }
      
      console.log('✅ Call status updated in database:', updatedCall);
      console.log('🎯 Updated call object:', JSON.stringify(updatedCall, null, 2));
      
      // Ensure we have the correct status
      if (updatedCall.call_status !== 'in-progress') {
        console.error('❌ Call status was not updated correctly! Expected: in-progress, Got:', updatedCall.call_status);
      }
      
      // Force clear incoming call first
      setIncomingCall(null);
      
      // Set active call with updated data  
      console.log('🎯 Setting activeCall state to call with status:', updatedCall.call_status);
      setActiveCall(updatedCall as Call);
      
      // Immediately show success feedback
      toast({
        title: "Call Connected", 
        description: `Connected to ${callToAnswer.customer_number} - Status: ${updatedCall.call_status}`,
      });
      
      // Load comprehensive customer profile data immediately
      console.log('📋 Loading customer profile for:', callToAnswer.customer_number);
      const { data: profile, error: profileError } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('phone_number', callToAnswer.customer_number)
          .maybeSingle();
      
      if (profileError) {
        console.error('❌ Error loading customer profile:', profileError);
      }
      
      if (profile) {
        console.log('📋 Customer profile loaded:', profile);
        setCustomerProfile(profile);
      } else {
        console.log('📋 No existing profile, attempting to create one...');
        // Try to find user by phone number and create profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', callToAnswer.customer_number)
          .maybeSingle();
        
        if (userError) {
          console.error('❌ Error loading user data:', userError);
        }
        
        if (userData) {
          console.log('📋 Found user data, creating profile:', userData);
          const { data: newProfile, error: createError } = await supabase
            .from('customer_profiles')
            .insert({
              phone_number: callToAnswer.customer_number,
              name: userData.full_name,
              email: userData.email,
              call_history_count: 1,
              last_interaction_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createError) {
            console.error('❌ Error creating customer profile:', createError);
          } else if (newProfile) {
            console.log('📋 New customer profile created:', newProfile);
            setCustomerProfile(newProfile);
          }
        } else {
          // Create minimal profile for unknown customer
          console.log('📋 Creating minimal profile for unknown customer');
          const { data: minimalProfile, error: minimalError } = await supabase
            .from('customer_profiles')
            .insert({
              phone_number: callToAnswer.customer_number,
              name: `Customer ${callToAnswer.customer_number.slice(-4)}`,
              call_history_count: 1,
              last_interaction_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (minimalError) {
            console.error('❌ Error creating minimal profile:', minimalError);
          } else if (minimalProfile) {
            console.log('📋 Minimal customer profile created:', minimalProfile);
            setCustomerProfile(minimalProfile);
          }
        }
      }

      // Start transcription with a small delay to ensure call is properly connected
      setTimeout(async () => {
        try {
          console.log('🎙️ Starting transcription for call:', callToAnswer.id);
          const { data: transcriptionResult, error: transcriptionError } = await supabase.functions.invoke('twilio-start-transcription', {
            body: { callId: callToAnswer.id }
          });
          
          if (transcriptionError) {
            console.error('❌ Transcription error:', transcriptionError);
            toast({
              title: "Transcription Warning",
              description: "Transcription may not be available for this call",
              variant: "destructive",
            });
          } else {
            console.log('✅ Transcription response:', transcriptionResult);
            if (transcriptionResult?.hasTranscription === false) {
              console.log('ℹ️ No Twilio SID available - transcription not started');
              toast({
                title: "Transcription Info",
                description: "Call connected, but live transcription unavailable",
              });
            } else {
              console.log('✅ Transcription started successfully');
              toast({
                title: "Transcription Started",
                description: "Live transcription is now active",
              });
            }
          }
        } catch (error) {
          console.error('❌ Failed to start transcription:', error);
          toast({
            title: "Transcription Warning", 
            description: "Could not start live transcription",
            variant: "destructive",
          });
        }
      }, 2000); // 2 second delay

    } catch (error) {
      console.error('❌ Error answering call:', error);
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
      // Call our edge function to properly end the Twilio call
      const { error } = await supabase.functions.invoke('twilio-end-call', {
        body: { callId: activeCall.id }
      });

      if (error) {
        throw error;
      }

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
        description: "Failed to end call properly",
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
        setActiveCall(data as Call);
        toast({
          title: "Incoming Call",
          description: `Call from ${data.customer_number}`,
        });
      }
    } catch (error) {
      console.error('Error creating call:', error);
    }
  };

  const handleSelectCall = (call: Call) => {
    setSelectedCall(call);
    setIsCallDetailsOpen(true);
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

        {showHeader && (
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
        )}

        {/* Sidebar - Call Panel */}
        <aside className={`w-80 border-r bg-sidebar ${showHeader ? 'pt-12' : ''}`}>
          <div className="p-4 h-full">
            <CallPanel
              activeCall={activeCall}
              onAnswerCall={handleAnswerCall}
              onEndCall={handleEndCall}
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 ${showHeader ? 'pt-12' : ''}`}>
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
              
              {/* Center - Customer Info and Chat History */}
              <div className="w-80 flex flex-col gap-4">
                <div className="flex-1">
                  <EnhancedCustomerInfoPanel 
                    customerProfile={customerProfile}
                    activeCall={activeCall}
                  />
                </div>
                <div className="flex-1">
                  <CustomerChatHistory 
                    customerProfile={customerProfile}
                    className="h-full"
                  />
                </div>
              </div>
              
              {/* Right Side - Call History */}
              <div className="w-80">
                <CallHistory 
                  onSelectCall={handleSelectCall}
                  className="h-full"
                />
              </div>
            </div>
          </div>
          
          {!showHeader && (
            <div className="absolute top-4 right-4 z-10">
              <button 
                onClick={simulateIncomingCall}
                className="text-sm px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Simulate Call
              </button>
            </div>
          )}
        </main>
        
        {/* Call Details Modal */}
        <CallDetailsModal
          call={selectedCall}
          isOpen={isCallDetailsOpen}
          onClose={() => {
            setIsCallDetailsOpen(false);
            setSelectedCall(null);
          }}
        />
      </div>
    </SidebarProvider>
  );
};