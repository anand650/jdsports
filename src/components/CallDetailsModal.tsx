import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Phone, User, MessageSquare, Lightbulb, Star, CheckCircle, AlertCircle } from 'lucide-react';
import { Call, Transcript, Suggestion, CustomerProfile } from '@/types/call-center';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CallDetailsModalProps {
  call: Call | null;
  isOpen: boolean;
  onClose: () => void;
}

interface CallDetailsData {
  transcripts: Transcript[];
  suggestions: Suggestion[];
  customerProfile: CustomerProfile | null;
  orderHistory: any[];
}

export const CallDetailsModal = ({ call, isOpen, onClose }: CallDetailsModalProps) => {
  const [callData, setCallData] = useState<CallDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [satisfactionScore, setSatisfactionScore] = useState<number>(0);
  const [resolutionStatus, setResolutionStatus] = useState<string>('');
  const [agentNotes, setAgentNotes] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (call && isOpen) {
      fetchCallDetails();
      setSatisfactionScore(call.satisfaction_score || 0);
      setResolutionStatus(call.resolution_status || 'pending');
    }
  }, [call, isOpen]);

  const fetchCallDetails = async () => {
    if (!call) return;
    
    setLoading(true);
    try {
      // Fetch transcripts
      const { data: transcripts } = await supabase
        .from('transcripts')
        .select('*')
        .eq('call_id', call.id)
        .order('created_at', { ascending: true });

      // Fetch suggestions
      const { data: suggestions } = await supabase
        .from('suggestions')
        .select('*')
        .eq('call_id', call.id)
        .order('created_at', { ascending: true });

      // Fetch customer profile
      const { data: customerProfile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('phone_number', call.customer_number)
        .single();

      // Fetch order history if customer profile exists
      let orderHistory = [];
      if (customerProfile) {
        // Try to find user by phone number and get orders
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('phone_number', customerProfile.phone_number)
          .single();

        if (user) {
          const { data: orders } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (
                *,
                product:products (*)
              )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

          orderHistory = orders || [];
        }
      }

      setCallData({
        transcripts: (transcripts || []) as Transcript[],
        suggestions: suggestions || [],
        customerProfile,
        orderHistory
      });
    } catch (error) {
      console.error('Error fetching call details:', error);
      toast({
        title: "Error",
        description: "Failed to load call details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCall = async () => {
    if (!call) return;

    try {
      const { error } = await supabase
        .from('calls')
        .update({
          satisfaction_score: satisfactionScore || null,
          resolution_status: resolutionStatus,
        })
        .eq('id', call.id);

      if (error) throw error;

      // Update customer notes if provided
      if (agentNotes && callData?.customerProfile) {
        await supabase
          .from('customer_profiles')
          .update({
            customer_notes: agentNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', callData.customerProfile.id);
      }

      toast({
        title: "Success",
        description: "Call details updated successfully",
      });

      onClose();
    } catch (error) {
      console.error('Error updating call:', error);
      toast({
        title: "Error", 
        description: "Failed to update call details",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'escalated': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'unresolved': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  if (!call) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Details - {call.customer_number}
            {getStatusIcon(call.resolution_status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left Column - Call Overview & Customer Info */}
          <div className="space-y-4">
            {/* Call Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Call Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span>{call.call_duration ? formatDuration(call.call_duration) : 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={call.call_status === 'completed' ? 'default' : 'secondary'}>
                    {call.call_status}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Started:</span>
                  <span>{format(new Date(call.started_at), 'MMM d, HH:mm')}</span>
                </div>
                {call.ended_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ended:</span>
                    <span>{format(new Date(call.ended_at), 'MMM d, HH:mm')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Direction:</span>
                  <Badge variant="outline">{call.call_direction}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            {callData?.customerProfile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Customer Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{callData.customerProfile.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{callData.customerProfile.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Call History:</span>
                    <span>{callData.customerProfile.call_history_count} calls</span>
                  </div>
                  {callData.customerProfile.tags && callData.customerProfile.tags.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-sm text-muted-foreground">Tags:</span>
                      <div className="flex flex-wrap gap-1">
                        {callData.customerProfile.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Orders */}
            {callData?.orderHistory && callData.orderHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {callData.orderHistory.map((order: any) => (
                        <div key={order.id} className="p-2 bg-muted/50 rounded text-xs">
                          <div className="flex justify-between">
                            <span>Order #{order.id.slice(-8)}</span>
                            <Badge variant="outline" className="text-xs">
                              {order.status}
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-1">
                            ${order.total_amount} - {format(new Date(order.created_at), 'MMM d')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Center Column - Conversation Transcript */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="h-80">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversation Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-56">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : callData?.transcripts && callData.transcripts.length > 0 ? (
                    <div className="space-y-3">
                      {callData.transcripts.map((transcript) => (
                        <div key={transcript.id} className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant={transcript.role === 'customer' ? 'default' : 'secondary'} className="text-xs">
                              {transcript.role === 'customer' ? 'Customer' : 'Agent'}
                            </Badge>
                            <span>{format(new Date(transcript.created_at), 'HH:mm:ss')}</span>
                          </div>
                          <p className="text-sm bg-muted/30 p-2 rounded">
                            {transcript.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      No transcript available
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* AI Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  AI Suggestions Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  {callData?.suggestions && callData.suggestions.length > 0 ? (
                    <div className="space-y-2">
                      {callData.suggestions.map((suggestion) => (
                        <div key={suggestion.id} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs">
                          <div className="flex items-center gap-2 text-muted-foreground mb-1">
                            <Lightbulb className="h-3 w-3" />
                            <span>{format(new Date(suggestion.created_at), 'HH:mm:ss')}</span>
                          </div>
                          <p>{suggestion.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      No suggestions available
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Call Analytics & Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Call Resolution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Satisfaction Score</label>
                    <Select value={satisfactionScore.toString()} onValueChange={(value) => setSatisfactionScore(Number(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Rate 1-5" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Not rated</SelectItem>
                        <SelectItem value="1">⭐ Poor (1)</SelectItem>
                        <SelectItem value="2">⭐⭐ Fair (2)</SelectItem>
                        <SelectItem value="3">⭐⭐⭐ Good (3)</SelectItem>
                        <SelectItem value="4">⭐⭐⭐⭐ Great (4)</SelectItem>
                        <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent (5)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Resolution Status</label>
                    <Select value={resolutionStatus} onValueChange={setResolutionStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="unresolved">Unresolved</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Agent Notes</label>
                  <Textarea
                    placeholder="Add notes about this call..."
                    value={agentNotes}
                    onChange={(e) => setAgentNotes(e.target.value)}
                    className="h-20"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleUpdateCall} size="sm" className="flex-1">
                    Update Call Details
                  </Button>
                  <Button variant="outline" onClick={onClose} size="sm">
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};