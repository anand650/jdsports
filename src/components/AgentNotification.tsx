import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, X, MessageCircle, User } from 'lucide-react';
import { ChatSession } from '@/types/ecommerce';

interface AgentNotificationProps {
  newSession: ChatSession | null;
  onTakeSession: (session: ChatSession) => void;
  onDismiss: () => void;
}

export const AgentNotification = ({ newSession, onTakeSession, onDismiss }: AgentNotificationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (newSession) {
      setIsVisible(true);
      // Auto-dismiss after 10 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [newSession, onDismiss]);

  if (!newSession || !isVisible) return null;

  const customerName = newSession.user?.full_name || newSession.user?.email || 'Anonymous User';
  const timeAgo = new Date(newSession.created_at).toLocaleTimeString();

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <Card className="w-80 shadow-lg border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <Bell className="h-4 w-4 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="font-medium text-orange-800">New Chat Request</h3>
                <p className="text-xs text-orange-600">Customer needs assistance</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-3 w-3 text-orange-600" />
              <span className="text-orange-800 font-medium">{customerName}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm">
              <MessageCircle className="h-3 w-3 text-orange-600" />
              <span className="text-orange-600">Started at {timeAgo}</span>
            </div>

            <Badge variant="destructive" className="w-fit">
              Escalated Chat
            </Badge>
          </div>

          <div className="flex space-x-2">
            <Button
              size="sm"
              onClick={() => {
                onTakeSession(newSession);
                setIsVisible(false);
                onDismiss();
              }}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              Take Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              className="px-3"
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};