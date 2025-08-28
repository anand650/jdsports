import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, BarChart3 } from 'lucide-react';
import { CallCenterLayout } from './CallCenterLayout';
import { AgentDashboard } from './AgentDashboard';
import { AnalyticsDashboard } from './AnalyticsDashboard';

type DashboardMode = 'call-center' | 'chat-support' | 'analytics';

export const UnifiedAgentDashboard = () => {
  const [mode, setMode] = useState<DashboardMode>('call-center');

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header with Mode Toggle */}
      <header className="h-14 flex items-center justify-between px-4 border-b bg-background z-20 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Agent Dashboard</h1>
          <Badge variant="outline" className="text-xs">
            {mode === 'call-center' ? 'Call Center Mode' : 
             mode === 'chat-support' ? 'Chat Support Mode' : 
             'Analytics Mode'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <Button
            variant={mode === 'call-center' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('call-center')}
            className="flex items-center gap-2 transition-all"
          >
            <Phone className="h-4 w-4" />
            Call Center
          </Button>
          <Button
            variant={mode === 'chat-support' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('chat-support')}
            className="flex items-center gap-2 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            Chat Support
          </Button>
          <Button
            variant={mode === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode('analytics')}
            className="flex items-center gap-2 transition-all"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        {mode === 'call-center' ? (
          <div className="h-full">
            <CallCenterLayout showHeader={false} />
          </div>
        ) : mode === 'chat-support' ? (
          <div className="h-full">
            <AgentDashboard showHeader={false} />
          </div>
        ) : (
          <div className="h-full">
            <AnalyticsDashboard />
          </div>
        )}
      </div>
    </div>
  );
};