import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CustomerProfile } from '@/types/call-center';

interface ChatSession {
  id: string;
  session_token: string;
  status: string;
  created_at: string;
  updated_at: string;
  escalated_at: string | null;
  assigned_agent_id: string | null;
  user_id: string | null;
  users?: {
    full_name: string | null;
    email: string;
  };
}

interface ChatMessage {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

interface CustomerChatHistoryProps {
  customerProfile: CustomerProfile | null;
  className?: string;
}

export const CustomerChatHistory = ({ customerProfile, className }: CustomerChatHistoryProps) => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Load chat sessions for the customer based on phone number
  useEffect(() => {
    if (!customerProfile?.phone_number) {
      setChatSessions([]);
      return;
    }

    const loadChatSessions = async () => {
      setLoading(true);
      try {
        // First, find the user by phone number
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('phone_number', customerProfile.phone_number);

        if (!userData || userData.length === 0) {
          setChatSessions([]);
          return;
        }

        const userIds = userData.map(user => user.id);

        // Then get chat sessions for these users
        const { data: sessions, error } = await supabase
          .from('chat_sessions')
          .select(`
            *,
            users!chat_sessions_user_id_fkey (
              full_name,
              email
            )
          `)
          .in('user_id', userIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) {
          console.error('Error loading chat sessions:', error);
          return;
        }

        setChatSessions(sessions || []);
      } catch (error) {
        console.error('Error loading chat sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChatSessions();
  }, [customerProfile?.phone_number]);

  // Load messages for selected session
  const loadMessages = async (sessionId: string) => {
    try {
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setMessages(messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSessionClick = (session: ChatSession) => {
    setSelectedSession(session);
    loadMessages(session.id);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default' as const, label: 'Active' },
      closed: { variant: 'secondary' as const, label: 'Closed' },
      escalated: { variant: 'destructive' as const, label: 'Escalated' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
                   { variant: 'outline' as const, label: status };

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return <User className="h-3 w-3" />;
      case 'agent':
        return <MessageCircle className="h-3 w-3" />;
      case 'bot':
        return <MessageCircle className="h-3 w-3 text-blue-500" />;
      default:
        return <MessageCircle className="h-3 w-3" />;
    }
  };

  if (!customerProfile) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center">
            No customer selected
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Chat History
          <Badge variant="outline" className="ml-auto">
            {chatSessions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Loading chat history...</p>
          </div>
        ) : chatSessions.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-muted-foreground">No chat history found</p>
          </div>
        ) : (
          <div className="flex h-96">
            {/* Sessions List */}
            <div className="w-1/2 border-r">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {chatSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedSession?.id === session.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">
                          {session.session_token}
                        </span>
                        {getStatusBadge(session.status)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(session.created_at)}
                      </div>
                      {session.users?.full_name && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {session.users.full_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Messages */}
            <div className="flex-1">
              {selectedSession ? (
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b bg-muted/30">
                    <div className="text-sm font-medium">
                      Session: {selectedSession.session_token}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(selectedSession.created_at)}
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-3 space-y-3">
                      {messages.map((message) => (
                        <div key={message.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getSenderIcon(message.sender_type)}
                            <span className="text-xs font-medium capitalize">
                              {message.sender_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(message.created_at)}
                            </span>
                          </div>
                          <div className="text-sm pl-5">
                            {message.content}
                          </div>
                        </div>
                      ))}
                      {messages.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center">
                          No messages in this session
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    Select a session to view messages
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};