import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Send, User, Bot, AlertTriangle, Database, ShoppingCart } from 'lucide-react';
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
      // Subscribe to real-time messages to avoid duplicates
      const channel = supabase
        .channel('chat_messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `session_id=eq.${session.id}`
          },
          (payload) => {
            const newMessage = payload.new as ChatMessage;
            // Only add if the message doesn't already exist (prevent duplicates)
            setMessages(prev => {
              const exists = prev.find(msg => msg.id === newMessage.id || 
                (msg.content === newMessage.content && msg.sender_type === newMessage.sender_type));
              if (exists) return prev;
              return [...prev, newMessage];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async () => {
    try {
      // Create session with user context if available
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

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      session_id: session.id,
      sender_type: 'user',
      content: input.trim(),
      metadata: {},
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Save user message to database (in a real app)
      // await supabase.from('chat_messages').insert(userMessage);

      // Simulate AI response (replace with actual AI integration)
      await simulateAIResponse(userMessage);
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

      // Set escalation flag and context info based on AI response
      setNeedsEscalation(response.needsEscalation);
      setContextUsed(response.contextUsed);
      
      // The AI response will be handled by real-time subscription
      // Just add it locally with immediate UI update to prevent delay
      const aiMessage: ChatMessage = {
        id: `ai_${Date.now()}`,
        session_id: session!.id,
        sender_type: 'ai',
        content: response.message,
        metadata: { 
          escalation_suggested: response.needsEscalation,
          from_rag: true,
          context_used: response.contextUsed
        },
        created_at: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
      
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
    if (!session) return;

    try {
      // Update session to escalated status
      await supabase
        .from('chat_sessions')
        .update({ 
          status: 'escalated',
          escalated_at: new Date().toISOString()
        })
        .eq('id', session.id);

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
      console.error('Error escalating chat:', error);
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
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">JD Sports Assistant</CardTitle>
              {user?.id && (
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Logged In
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {session?.status === 'escalated' && (
                <Badge variant="secondary">Agent Requested</Badge>
              )}
              {contextUsed && (
                <div className="flex space-x-1">
                  {contextUsed.knowledgeBase > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Database className="h-3 w-3 mr-1" />
                      KB: {contextUsed.knowledgeBase}
                    </Badge>
                  )}
                  {contextUsed.userOrders === 'yes' && (
                    <Badge variant="outline" className="text-xs">
                      Orders ✓
                    </Badge>
                  )}
                  {contextUsed.userCart === 'yes' && (
                    <Badge variant="outline" className="text-xs">
                      <ShoppingCart className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
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
                      {message.metadata?.escalation_suggested && needsEscalation && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={requestHumanAgent}
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
              <div className="flex space-x-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
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