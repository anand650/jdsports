import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing, 
  Clock, 
  Calendar,
  Eye,
  Filter,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Call } from '@/types/call-center';

interface CallHistoryProps {
  onSelectCall?: (call: Call) => void;
  className?: string;
}

export const CallHistory = ({ onSelectCall, className }: CallHistoryProps) => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');

  useEffect(() => {
    loadCalls();
    
    // Subscribe to real-time call updates
    const channel = supabase
      .channel('call-history-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls'
        },
        (payload) => {
          console.log('📞 Call history update detected:', payload);
          loadCalls(); // Reload calls when any change happens
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let filtered = calls;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(call => 
        call.customer_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(call => call.call_status === statusFilter);
    }

    // Direction filter
    if (directionFilter !== 'all') {
      filtered = filtered.filter(call => call.call_direction === directionFilter);
    }

    setFilteredCalls(filtered);
  }, [calls, searchTerm, statusFilter, directionFilter]);

  const loadCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCalls((data as Call[]) || []);
    } catch (error) {
      console.error('Error loading call history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'completed': { variant: 'default', label: 'Completed' },
      'in-progress': { variant: 'secondary', label: 'In Progress' },
      'ringing': { variant: 'secondary', label: 'Ringing' },
      'busy': { variant: 'destructive', label: 'Busy' },
      'no-answer': { variant: 'outline', label: 'No Answer' },
      'failed': { variant: 'destructive', label: 'Failed' },
      'canceled': { variant: 'outline', label: 'Canceled' }
    } as const;

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.completed;
    
    return (
      <Badge variant={config.variant as any} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getDirectionIcon = (direction: string) => {
    if (direction === 'inbound') {
      return <PhoneIncoming className="h-4 w-4 text-green-600" />;
    }
    return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
  };

  return (
    <Card className={`h-[600px] max-h-[70vh] bg-sidebar border-sidebar-border flex flex-col ${className}`}>
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sidebar-foreground flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call History
            <Badge variant="secondary" className="ml-2">
              {filteredCalls.length} calls
            </Badge>
          </CardTitle>
        </div>
        
        {/* Filters */}
        <div className="space-y-3 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by phone number or call ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="ringing">Ringing</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="no-answer">No Answer</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={directionFilter} onValueChange={setDirectionFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All directions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Directions</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full px-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebar-primary"></div>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-sidebar-primary mx-auto mb-4" />
              <p className="text-sidebar-foreground font-medium">
                {calls.length === 0 ? 'No Call History' : 'No Matching Calls'}
              </p>
              <p className="text-sm text-sidebar-accent-foreground mt-2">
                {calls.length === 0 
                  ? 'Call history will appear here once you start making or receiving calls'
                  : 'Try adjusting your search filters'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredCalls.map((call, index) => (
                <div key={call.id}>
                  <div 
                    className="p-3 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer hover:bg-gray-50/50"
                    onClick={() => onSelectCall?.(call)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getDirectionIcon(call.call_direction || 'inbound')}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm text-gray-900 truncate">
                              {call.customer_number}
                            </p>
                            {getStatusBadge(call.call_status || 'completed')}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(call.started_at)}
                            </div>
                            
                            {call.call_duration && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(call.call_duration)}
                              </div>
                            )}
                            
                            <div className="text-xs text-gray-400">
                              {call.call_direction?.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {onSelectCall && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-shrink-0 h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {index < filteredCalls.length - 1 && (
                    <Separator className="my-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};