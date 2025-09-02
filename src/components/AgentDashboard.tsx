import React, { useState, useEffect } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AgentSidebar } from './AgentSidebar';
import { ChatPanel } from './ChatPanel';
import { AgentNotification } from './AgentNotification';
import { ChatSession, ChatMessage } from '@/types/ecommerce';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

interface AgentDashboardProps {
  showHeader?: boolean;
}

export const AgentDashboard = ({ showHeader = true }: AgentDashboardProps) => {
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSessionNotification, setNewSessionNotification] = useState<ChatSession | null>(null);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession.id);
    }
  }, [selectedSession?.id]); // Only depend on session ID to prevent unnecessary refetches

  useEffect(() => {
    // Subscribe to new chat sessions - listen for both escalated sessions and newly created ones
    const sessionsChannel = supabase
      .channel('chat_sessions_agent')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions'
        },
        async (payload) => {
          const session = payload.new as ChatSession;
          
          // Only handle sessions that are escalated or need agent attention
          if (session.status === 'escalated') {
            // Fetch complete session with user details separately
            const { data: sessionData } = await supabase
              .from('chat_sessions')
              .select('*')
              .eq('id', session.id)
              .single();

            if (sessionData) {
              let userData = null;
              if (sessionData.user_id) {
                const { data: userResult } = await supabase
                  .from('users')
                  .select('id, full_name, email')
                  .eq('id', sessionData.user_id)
                  .single();
                userData = userResult;
              }

              const sessionWithUser = {
                ...sessionData,
                user: userData
              } as ChatSession;

              setActiveSessions(prev => {
                const exists = prev.find(s => s.id === session.id);
                if (exists) {
                  return prev.map(s => s.id === session.id ? sessionWithUser : s);
                } else {
                  return [sessionWithUser, ...prev];
                }
              });

              // Enhanced notification with customer details
              const customerName = sessionWithUser.user?.full_name || sessionWithUser.user?.email || 'Anonymous User';
              
              // Show prominent notification
              setNewSessionNotification(sessionWithUser);
              
              toast({
                title: "🔔 New Chat Escalated",
                description: `${customerName} needs human assistance`,
              });

              // Play notification sound (optional)
              try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwYZaLvt559NEAxQp+PwtmMcBjiR1/LKdSEBMXfK5tCSKAUbV6+Z4pVJExBQr+r2vGciBSWL3PWteRwBJYPO8duKMgYYaLHf54lKDgpPr+n4vWcjByqG2+7D0yIFJIbN78CQPwAAaLfq4IpLDwdQr+j8oWwf');
                audio.volume = 0.3;
                audio.play().catch(() => {}); // Ignore if audio fails
              } catch (e) {}
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_sessions',
          filter: 'status=eq.escalated'
        },
        async (payload) => {
          // Handle newly created escalated sessions
          const session = payload.new as ChatSession;
          await handleNewEscalatedSession(session);
        }
      )
      .subscribe();

    // Helper function to handle new escalated sessions
    const handleNewEscalatedSession = async (session: ChatSession) => {
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', session.id)
        .single();

      if (sessionData) {
        let userData = null;
        if (sessionData.user_id) {
          const { data: userResult } = await supabase
            .from('users')
            .select('id, full_name, email')
            .eq('id', sessionData.user_id)
            .single();
          userData = userResult;
        }

        const sessionWithUser = {
          ...sessionData,
          user: userData
        } as ChatSession;

        setActiveSessions(prev => [sessionWithUser, ...prev]);
        
        const customerName = sessionWithUser.user?.full_name || sessionWithUser.user?.email || 'Anonymous User';
        setNewSessionNotification(sessionWithUser);
        
        toast({
          title: "🔔 New Chat Escalated",
          description: `${customerName} needs human assistance`,
        });
      }
    };

    // Subscribe to messages for selected session using unified channel
    let messagesChannel: any = null;
    if (selectedSession) {
      messagesChannel = supabase
        .channel(`chat_session_${selectedSession.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${selectedSession.id}`
          },
          (payload) => {
            const message = payload.new as ChatMessage;
            console.log('📨 Agent received new message via real-time:', message);
            
            // Only add user and AI messages via real-time (agent messages are added optimistically)
            if (message.sender_type === 'user' || message.sender_type === 'ai') {
              setMessages(prev => {
                // Check for duplicates
                const exists = prev.find(msg => msg.id === message.id);
                if (exists) {
                  console.log('⚠️ Message already exists in agent view, skipping:', message.id);
                  return prev;
                }
                
                console.log('✅ Adding', message.sender_type, 'message to agent view');
                return [...prev, message].sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              });
            } else if (message.sender_type === 'agent') {
              // Don't add agent messages from real-time, but also don't show error for handover messages
              if (message.metadata?.is_agent_handover) {
                console.log('⚠️ Ignoring agent handover message from real-time (expected behavior)');
              } else {
                console.log('⚠️ Ignoring agent message from real-time (already added optimistically)');
              }
            }
          }
        )
        .subscribe();
    }

    return () => {
      supabase.removeChannel(sessionsChannel);
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
      }
    };
  }, [selectedSession, toast]);

  const fetchActiveSessions = async () => {
    try {
      console.log('🔍 Fetching active sessions...');
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          *
        `)
        .in('status', ['escalated'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching sessions:', error);
        throw error;
      }
      
      console.log('📊 Raw sessions data:', data);
      
      // Fetch user details separately for sessions that have user_id
      const sessionsWithUsers = await Promise.all(
        (data || []).map(async (session) => {
          if (session.user_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('id, full_name, email')
              .eq('id', session.user_id)
              .single();
            
            console.log(`User data for session ${session.id}:`, userData);
            
            return {
              ...session,
              user: userData || null
            };
          }
          return {
            ...session,
            user: null
          };
        })
      );
      
      console.log('✅ Transformed sessions:', sessionsWithUsers);
      console.log('🔥 Escalated sessions:', sessionsWithUsers.filter(s => s.status === 'escalated'));
      
      setActiveSessions(sessionsWithUsers as ChatSession[]);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load chat sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data as ChatMessage[] || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  };

  const handleTakeSession = async (session: ChatSession) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ 
          assigned_agent_id: user.id,
          status: 'escalated'
        })
        .eq('id', session.id);

      if (error) throw error;

      setSelectedSession({ ...session, assigned_agent_id: user.id, status: 'escalated' });
      
      toast({
        title: "Session Assigned",
        description: "You are now handling this chat session",
      });
    } catch (error) {
      console.error('Error taking session:', error);
      toast({
        title: "Error",
        description: "Failed to take session",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedSession || !user) return;

    const tempMessage: ChatMessage = {
      id: `temp_agent_${Date.now()}`,
      session_id: selectedSession.id,
      sender_type: 'agent',
      sender_id: user.id,
      content,
      metadata: {},
      created_at: new Date().toISOString()
    };

    // Add message optimistically to agent view
    setMessages(prev => [...prev, tempMessage]);

    try {
      const { data: insertedMessage, error } = await supabase
        .from('chat_messages')
        .insert({
          session_id: selectedSession.id,
          sender_type: 'agent',
          sender_id: user.id,
          content,
          metadata: {}
        })
        .select()
        .single();

      if (error) throw error;

      // Update the temporary message with real ID from database
      setMessages(prev => prev.map(msg => 
        msg.id === tempMessage.id 
          ? { ...msg, id: insertedMessage.id, created_at: insertedMessage.created_at }
          : msg
      ));

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the failed message
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleCloseSession = async (session: ChatSession) => {
    try {
      console.log('🔄 Starting session handover process for session:', session.id);
      console.log('🔄 Current user:', user?.id, 'Role:', user);
      
      // First, send a message to inform the customer about the handover back to AI
      // (while the agent is still assigned to the session)
      const handoverMessage = {
        session_id: session.id,
        sender_type: 'agent' as const,
        sender_id: user?.id,
        content: "I've completed my assistance and am now handing your chat back to our AI assistant. They'll continue to help you with any additional questions!",
        metadata: { is_agent_handover: true }
      };

      console.log('📝 Attempting to insert handover message...');
      const { error: messageError } = await supabase
        .from('chat_messages')
        .insert(handoverMessage);

      if (messageError) {
        console.error('❌ Error sending handover message:', messageError);
        throw messageError;
      }
      console.log('✅ Handover message sent successfully');

      // Add a small delay to ensure any async operations complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then revert session back to AI handling - try step by step
      console.log('🔄 Attempting to update session...');
      try {
        // Test with just status first
        console.log('📝 Step 1: Updating status only...');
        const { error: statusError } = await supabase
          .from('chat_sessions')
          .update({ status: 'active' })
          .eq('id', session.id);

        if (statusError) {
          console.error('❌ Status update error:', statusError);
          throw statusError;
        }
        console.log('✅ Status updated successfully');

        // Then clear agent assignment
        console.log('📝 Step 2: Clearing agent assignment...');
        const { error: agentError } = await supabase
          .from('chat_sessions')
          .update({ assigned_agent_id: null })
          .eq('id', session.id);

        if (agentError) {
          console.error('❌ Agent clearing error:', agentError);
          throw agentError;
        }
        console.log('✅ Agent assignment cleared successfully');

        // Finally clear escalation timestamp
        console.log('📝 Step 3: Clearing escalation timestamp...');
        const { error: escalationError } = await supabase
          .from('chat_sessions')
          .update({ escalated_at: null })
          .eq('id', session.id);

        if (escalationError) {
          console.error('❌ Escalation clearing error:', escalationError);
          throw escalationError;
        }
        console.log('✅ Session fully updated successfully');
        
      } catch (sessionError) {
        console.error('❌ Caught session update error:', sessionError);
        throw sessionError;
      }

      // After successful handover, trigger AI welcome back message
      console.log('🤖 Triggering AI welcome back response...');
      try {
        const { data: aiResponse, error: aiError } = await supabase.functions.invoke('chatbot-rag', {
          body: {
            message: "Hello! I'm back to assist you. How can I help you today?",
            sessionId: session.id,
            userId: session.user_id,
            isHandoverResponse: true
          }
        });

        if (aiError) {
          console.error('❌ Error triggering AI welcome response:', aiError);
        } else {
          console.log('✅ AI welcome response triggered successfully');
        }
      } catch (aiResponseError) {
        console.error('❌ Failed to trigger AI response after handover:', aiResponseError);
        // Don't throw - handover was successful even if AI response failed
      }

      setActiveSessions(prev => prev.filter(s => s.id !== session.id));
      if (selectedSession?.id === session.id) {
        setSelectedSession(null);
        setMessages([]);
      }

      toast({
        title: "Session Handed Back to AI",
        description: "Chat has been returned to AI assistant",
      });
    } catch (error) {
      console.error('❌ Error handing session back to AI:', error);
      toast({
        title: "Error",
        description: "Failed to hand session back to AI",
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex flex-col w-full bg-background">
        {showHeader && (
          <header className="h-12 flex items-center border-b bg-background z-20 flex-shrink-0">
            <SidebarTrigger className="ml-2" />
            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold">Agent Dashboard</h1>
            </div>
          </header>
        )}

        {/* Content Area */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <AgentSidebar
            sessions={activeSessions}
            selectedSession={selectedSession}
            onSelectSession={setSelectedSession}
            onTakeSession={handleTakeSession}
            onCloseSession={handleCloseSession}
            loading={loading}
          />

          {/* Main Content */}
          <main className="flex-1 h-full">
          {selectedSession ? (
            <ChatPanel
              session={selectedSession}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-2xl font-semibold mb-2">Welcome, {userProfile?.full_name || 'Agent'}</h2>
                <p className="text-muted-foreground">
                  Select a chat session from the sidebar to start assisting customers
                </p>
              </div>
            </div>
            )}
          </main>
        </div>

        {/* Prominent notification for new chats */}
        <AgentNotification
          newSession={newSessionNotification}
          onTakeSession={(session) => {
            handleTakeSession(session);
            setNewSessionNotification(null);
          }}
          onDismiss={() => setNewSessionNotification(null)}
        />
      </div>
    </SidebarProvider>
  );
};