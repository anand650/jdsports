import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, User, Bot, Shield } from 'lucide-react';
import { ChatSession, ChatMessage } from '@/types/ecommerce';

interface ChatPanelProps {
  session: ChatSession;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
}

export const ChatPanel = ({ session, messages, onSendMessage }: ChatPanelProps) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'agent':
        return <Shield className="h-4 w-4" />;
      case 'ai':
        return <Bot className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getSenderColor = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return 'bg-blue-500';
      case 'agent':
        return 'bg-green-500';
      case 'ai':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Chat Session {session.session_token.slice(-8)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {session.user_id ? `User ${session.user_id.slice(0, 8)}` : 'Anonymous User'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={session.status === 'escalated' ? 'destructive' : 'secondary'}>
              {session.status === 'escalated' ? 'Escalated' : 'Active'}
            </Badge>
            {session.assigned_agent_id && (
              <Badge variant="outline">
                Assigned
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No messages yet</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[80%] ${
                  message.sender_type === 'agent' ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${getSenderColor(message.sender_type)}`}>
                    {getSenderIcon(message.sender_type)}
                  </div>
                  <div className="space-y-1">
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        message.sender_type === 'agent'
                          ? 'bg-primary text-primary-foreground'
                          : message.sender_type === 'user'
                          ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-muted-foreground">
                        {message.sender_type === 'user' ? 'Customer' : 
                         message.sender_type === 'agent' ? 'You' : 'AI Assistant'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response..."
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};