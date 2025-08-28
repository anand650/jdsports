import React, { useState, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AgentSidebar } from './AgentSidebar';
import { ChatPanel } from './ChatPanel';
import { ChatSession, ChatMessage } from '@/types/ecommerce';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const AgentDashboard = () => {
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveSessions();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession.id);
    }
  }, [selectedSession]);

  useEffect(() => {
    // Subscribe to new chat sessions
    const sessionsChannel = supabase
      .channel('chat_sessions_agent')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: 'status=eq.escalated'
        },
        (payload) => {
          const session = payload.new as ChatSession;
          setActiveSessions(prev => {
            const exists = prev.find(s => s.id === session.id);
            if (exists) {
              return prev.map(s => s.id === session.id ? session : s);
            } else {
              return [...prev, session];
            }
          });
          
          toast({
            title: "New Chat Escalated",
            description: "A customer has requested human assistance",
          });
        }
      )
      .subscribe();

    // Subscribe to messages for selected session
    let messagesChannel: any = null;
    if (selectedSession) {
      messagesChannel = supabase
        .channel('chat_messages_agent')
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
            setMessages(prev => [...prev, message]);
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
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .in('status', ['active', 'escalated'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveSessions(data as ChatSession[] || []);
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

    const message = {
      session_id: selectedSession.id,
      sender_type: 'agent' as const,
      sender_id: user.id,
      content,
      metadata: {},
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert(message);

      if (error) throw error;

      // Message will be added via real-time subscription
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleCloseSession = async (session: ChatSession) => {
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ status: 'closed' })
        .eq('id', session.id);

      if (error) throw error;

      setActiveSessions(prev => prev.filter(s => s.id !== session.id));
      if (selectedSession?.id === session.id) {
        setSelectedSession(null);
        setMessages([]);
      }

      toast({
        title: "Session Closed",
        description: "Chat session has been ended",
      });
    } catch (error) {
      console.error('Error closing session:', error);
      toast({
        title: "Error",
        description: "Failed to close session",
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
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
        <main className="flex-1">
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
    </SidebarProvider>
  );
};