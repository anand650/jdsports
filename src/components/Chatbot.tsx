import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, X, Send, User, Bot, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ChatSession } from '@/types/ecommerce';
import { useToast } from '@/components/ui/use-toast';

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [session, setSession] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsEscalation, setNeedsEscalation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
      // Subscribe to real-time messages
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
            setMessages(prev => [...prev, newMessage]);
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
      // For demo, create anonymous session
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          session_token: `session_${Date.now()}`,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      setSession(data as ChatSession);

      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        session_id: data.id,
        sender_type: 'ai',
        content: "Hi! I'm your JD Sports assistant. I can help you find products, check your orders, or answer any questions about our store. How can I help you today?",
        metadata: {},
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
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const content = userMessage.content.toLowerCase();
    let response = '';
    let shouldEscalate = false;

    if (content.includes('complaint') || content.includes('refund') || content.includes('problem') || content.includes('issue')) {
      response = "I understand you're having an issue. Let me connect you with one of our customer service representatives who can better assist you with this matter.";
      shouldEscalate = true;
    } else if (content.includes('order') || content.includes('delivery')) {
      response = "I can help you track your order! To check your order status, I'll need your order number. You can find it in your confirmation email. Alternatively, you can log in to your account to view all your orders.";
    } else if (content.includes('size') || content.includes('fit')) {
      response = "For sizing help, I recommend checking our size guide on each product page. We also offer free returns within 365 days, so you can exchange for a different size if needed. What product are you looking at?";
    } else if (content.includes('price') || content.includes('discount') || content.includes('sale')) {
      response = "We regularly have sales and promotions! Check out our Sale section for the latest deals. You can also sign up for our newsletter to get exclusive offers and early access to sales.";
    } else {
      response = "Thanks for your message! I'm here to help with product information, order tracking, sizing questions, and general store inquiries. Is there something specific I can assist you with today?";
    }

    const aiMessage: ChatMessage = {
      id: `ai_${Date.now()}`,
      session_id: session!.id,
      sender_type: 'ai',
      content: response,
      metadata: { escalation_suggested: shouldEscalate },
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, aiMessage]);
    setNeedsEscalation(shouldEscalate);
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
        <Card className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 h-[500px] flex flex-col shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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

          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-[80%] ${
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
                      className={`px-3 py-2 rounded-lg ${
                        message.sender_type === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      {message.metadata?.escalation_suggested && (
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
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  size="icon"
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