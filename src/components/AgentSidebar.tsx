import React from 'react';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, User, Clock, X, CheckCircle } from 'lucide-react';
import { ChatSession } from '@/types/ecommerce';

interface AgentSidebarProps {
  sessions: ChatSession[];
  selectedSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
  onTakeSession: (session: ChatSession) => void;
  onCloseSession: (session: ChatSession) => void;
  loading: boolean;
}

export const AgentSidebar = ({
  sessions,
  selectedSession,
  onSelectSession,
  onTakeSession,
  onCloseSession,
  loading
}: AgentSidebarProps) => {
  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-500';
      case 'escalated':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Sidebar className="w-80 border-r h-full">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Agent Dashboard</h2>
              <p className="text-sm text-muted-foreground">
                {sessions.length} active sessions
              </p>
            </div>
          </div>
          {sessions.filter(s => s.status === 'escalated' && !s.assigned_agent_id).length > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {sessions.filter(s => s.status === 'escalated' && !s.assigned_agent_id).length} waiting
            </Badge>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0">
        <div className="p-4 space-y-2 h-full">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Active Chat Sessions
          </h3>

          {loading ? (
            // Loading skeleton
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center space-x-2">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No active chat sessions
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              <SidebarMenu>
                {sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <div
                      className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                        selectedSession?.id === session.id ? 'bg-accent border-primary' : ''
                      }`}
                      onClick={() => onSelectSession(session)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(session.status)}`} />
                          <Badge variant={session.status === 'escalated' ? 'destructive' : 'secondary'}>
                            {session.status === 'escalated' ? 'Needs Help' : 'Active'}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseSession(session);
                            }}
                            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground truncate">
                            {session.user?.full_name || session.user?.email || 'Anonymous User'}
                          </span>
                        </div>

                        {session.user?.email && session.user?.full_name && (
                          <div className="text-xs text-muted-foreground truncate pl-5">
                            {session.user.email}
                          </div>
                        )}

                        <div className="flex items-center space-x-2 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {formatTime(session.created_at)}
                          </span>
                        </div>

                        {session.status === 'escalated' && !session.assigned_agent_id && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTakeSession(session);
                            }}
                            className="w-full mt-2"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Take Session
                          </Button>
                        )}

                        {session.assigned_agent_id && (
                          <div className="flex items-center space-x-2 text-xs">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-green-600">Assigned to Agent</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </div>
          )}
        </div>
      </SidebarContent>
    </Sidebar>
  );
};