import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Send, User, Bot, AlertTriangle, Database, ShoppingCart, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ChatSession } from '@/types/ecommerce';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsEscalation, setNeedsEscalation] = useState(false);
  const [contextUsed, setContextUsed] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  useEffect(() => {
    if (isOpen && !session) {
      initializeSession();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (session) {
      console.log('🔄 Setting up real-time subscription for session:', session.id);
      
      // Subscribe to real-time messages for this session using unified channel
      const messagesChannel = supabase
        .channel(`chat_session_${session.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${session.id}`
          },
          (payload) => {
            console.log('📨 Customer received new message via real-time:', payload.new);
            const newMessage = payload.new as ChatMessage;
            
            // Only add agent and AI messages via real-time (user messages are added optimistically)
            if (newMessage.sender_type === 'agent' || newMessage.sender_type === 'ai') {
              setMessages(prev => {
                // Check if message already exists to prevent duplicates
                const exists = prev.find(msg => msg.id === newMessage.id);
                if (exists) {
                  console.log('⚠️ Customer: Message already exists, skipping:', newMessage.id);
                  return prev;
                }
                
                console.log('✅ Customer: Adding', newMessage.sender_type, 'message to chat');
                return [...prev, newMessage].sort((a, b) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              });
            } else {
              console.log('⚠️ Customer: Ignoring user message from real-time (already added optimistically)');
            }
          }
        )
        .subscribe();

      // Subscribe to session updates to detect human agent takeover
      const sessionChannel = supabase
        .channel(`chat_session_updates_${session.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_sessions',
            filter: `id=eq.${session.id}`
          },
          (payload) => {
            const updatedSession = payload.new as ChatSession;
            setSession(updatedSession);
            
            // If human agent took over, notify user and disable escalation
            if (updatedSession.assigned_agent_id && updatedSession.status === 'escalated' && 
                !session.assigned_agent_id) {
              setNeedsEscalation(false);
              const agentTakeoverMessage: ChatMessage = {
                id: `agent_takeover_${Date.now()}`,
                session_id: session.id,
                sender_type: 'ai',
                content: "🎧 A human customer service agent has joined the chat and will assist you from now on. Please continue the conversation with them.",
                metadata: { is_agent_takeover: true },
                created_at: new Date().toISOString()
              };
              setMessages(prev => [...prev, agentTakeoverMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              ));
              
              toast({
                title: "Human Agent Connected",
                description: "A customer service representative is now handling your chat",
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(sessionChannel);
      };
    }
  }, [session, toast]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async () => {
    try {
      // First, check if user has any active sessions
      if (user?.id) {
        const { data: existingSession } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['active', 'escalated'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingSession) {
          console.log('🔄 Resuming existing session:', existingSession.id);
          setSession(existingSession as ChatSession);
          
          // Load existing messages
          const { data: existingMessages } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', existingSession.id)
            .order('created_at', { ascending: true });

          if (existingMessages && existingMessages.length > 0) {
            setMessages(existingMessages as ChatMessage[]);
            return; // Don't add welcome message if messages exist
          }
        }
      }

      // Create new session only if no active session exists
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          session_token: `session_${Date.now()}`,
          status: 'active',
          user_id: user?.id || null
        })
        .select()
        .single();

      if (error) throw error;
      setSession(data as ChatSession);

      // Add personalized welcome message
      const welcomeContent = user?.id 
        ? `Hi ${userProfile?.full_name || 'there'}! I'm your JD Sports assistant with access to your order history and cart. I can help you find products, check your orders, track shipments, or answer any questions about our store. How can I help you today?`
        : "Hi! I'm your JD Sports assistant. I can help you find products or answer questions about our store. For personalized help with orders and your cart, please log in. How can I help you today?";

      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        session_id: data.id,
        sender_type: 'ai',
        content: welcomeContent,
        metadata: { is_welcome: true, user_authenticated: !!user?.id },
        created_at: new Date().toISOString()
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Error initializing session:', error);
      toast({
        title: "Error",
        description: "Failed to initialize chat session",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !session || isLoading) return;

    // Check if session is handled by human agent
    if (session.status === 'escalated' && session.assigned_agent_id) {
      toast({
        title: "Human Agent Active",
        description: "Your message will be sent directly to the human agent",
      });
    }

    const messageContent = input.trim();
    setInput('');
    setIsLoading(true);

    // Create user message for immediate UI update
    const userMessage: ChatMessage = {
      id: `temp_${Date.now()}`, // Temporary ID until DB insert
      session_id: session.id,
      sender_type: 'user',
      content: messageContent,
      metadata: { user_id: user?.id || null },
      created_at: new Date().toISOString()
    };

    // Immediately show user message (optimistic update)
    setMessages(prev => [...prev, userMessage]);

    try {
      // Save to database
      const { data: insertedMessage, error } = await supabase.from('chat_messages').insert({
        session_id: session.id,
        sender_type: 'user',
        content: messageContent,
        metadata: { user_id: user?.id || null }
      }).select().single();

      if (error) throw error;

      // Update the message with real ID from database
      setMessages(prev => prev.map(msg => 
        msg.id === userMessage.id 
          ? { ...msg, id: insertedMessage.id, created_at: insertedMessage.created_at }
          : msg
      ));

      // Only get AI response if not escalated to human
      if (!(session.status === 'escalated' && session.assigned_agent_id)) {
        const finalUserMessage: ChatMessage = {
          id: insertedMessage.id,
          session_id: session.id,
          sender_type: 'user',
          content: messageContent,
          metadata: { user_id: user?.id || null },
          created_at: insertedMessage.created_at
        };
        await simulateAIResponse(finalUserMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const simulateAIResponse = async (userMessage: ChatMessage) => {
    try {
      // Call our enhanced RAG chatbot endpoint with user context
      const { data, error } = await supabase.functions.invoke('chatbot-rag', {
        body: {
          message: userMessage.content,
          sessionId: session!.id,
          userId: user?.id || null
        }
      });

      if (error) {
        console.error('Error calling chatbot function:', error);
        throw error;
      }

      const response = data;
      if (!response.success) {
        throw new Error(response.error || 'Failed to get AI response');
      }

      // Handle human takeover scenario
      if (response.humanTakeover) {
        // Don't set escalation flag or show AI response for human takeover
        return;
      }

      // Set escalation flag and context info based on AI response
      setNeedsEscalation(response.needsEscalation);
      setContextUsed(response.contextUsed);
      
      // AI response will come through real-time subscription
      // Don't add it locally to prevent duplicates
      
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Fallback response
      const fallbackMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        session_id: session!.id,
        sender_type: 'ai',
        content: "I'm sorry, I'm having trouble processing your message right now. Please try again in a moment, or I can connect you with one of our human agents for immediate assistance.",
        metadata: { escalation_suggested: true, is_fallback: true },
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, fallbackMessage]);
      setNeedsEscalation(true);
    }
  };

  const requestHumanAgent = async () => {
    if (!session) {
      console.error('❌ No session available for escalation');
      return;
    }

    console.log('🚀 Escalating chat session:', session.id);
    
    try {
      // Update session to escalated status
      const { data, error } = await supabase
        .from('chat_sessions')
        .update({ 
          status: 'escalated',
          escalated_at: new Date().toISOString()
        })
        .eq('id', session.id)
        .select();

      if (error) {
        console.error('❌ Database error during escalation:', error);
        throw error;
      }

      console.log('✅ Session escalated successfully:', data);

      const escalationMessage: ChatMessage = {
        id: `escalation_${Date.now()}`,
        session_id: session.id,
        sender_type: 'ai',
        content: "I've escalated your chat to our human customer service team. A representative will join this conversation shortly to assist you further.",
        metadata: { is_escalation: true },
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, escalationMessage]);
      setNeedsEscalation(false);

      toast({
        title: "Chat Escalated",
        description: "A human agent will assist you shortly",
      });
    } catch (error) {
      console.error('❌ Error escalating chat:', error);
      toast({
        title: "Error",
        description: "Failed to escalate chat",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
        size="icon"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 max-h-[500px] flex flex-col shadow-2xl border">
          <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2 px-4 py-3 border-b">
            <CardTitle className="text-lg">JD Sports Assistant</CardTitle>
            <div className="flex items-center space-x-2">
              {session?.status === 'escalated' && (
                <Badge variant="secondary">Agent Requested</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[85%] ${
                    message.sender_type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                    <div className="flex-shrink-0">
                      {message.sender_type === 'user' ? (
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                          <Bot className="h-4 w-4 text-accent-foreground" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`px-3 py-2 rounded-lg break-words ${
                        message.sender_type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.metadata?.escalation_suggested && needsEscalation && 
                       !(session?.status === 'escalated' && session?.assigned_agent_id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            console.log('🔴 Talk to Human Agent button clicked!');
                            e.preventDefault();
                            e.stopPropagation();
                            requestHumanAgent();
                          }}
                          className="mt-2 w-full"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Talk to Human Agent
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-lg">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t bg-background">
              {session?.status === 'escalated' && session?.assigned_agent_id && (
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200 flex items-center">
                    <Shield className="h-4 w-4 mr-2" />
                    You're now chatting with a human customer service agent
                  </p>
                </div>
              )}
              <div className="flex space-x-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={
                    session?.status === 'escalated' && session?.assigned_agent_id 
                      ? "Message the human agent..." 
                      : "Type your message..."
                  }
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};