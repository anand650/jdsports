import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, 
  User, 
  Mail, 
  Clock, 
  MapPin, 
  Tag, 
  MessageSquare, 
  ShoppingCart,
  Package,
  DollarSign,
  Star,
  Calendar
} from 'lucide-react';
import { Call, CustomerProfile } from '@/types/call-center';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface EnhancedCustomerInfoPanelProps {
  customerProfile: CustomerProfile | null;
  activeCall: Call | null;
}

interface CustomerData {
  profile: CustomerProfile | null;
  user: any | null;
  orders: any[];
  callHistory: Call[];
  totalSpent: number;
  avgSatisfaction: number;
}

export const EnhancedCustomerInfoPanel = ({ customerProfile, activeCall }: EnhancedCustomerInfoPanelProps) => {
  const [customerData, setCustomerData] = useState<CustomerData>({
    profile: null,
    user: null,
    orders: [],
    callHistory: [],
    totalSpent: 0,
    avgSatisfaction: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (customerProfile) {
      fetchEnhancedCustomerData(customerProfile);
    } else {
      setCustomerData({
        profile: null,
        user: null,
        orders: [],
        callHistory: [],
        totalSpent: 0,
        avgSatisfaction: 0
      });
    }
  }, [customerProfile]);

  const fetchEnhancedCustomerData = async (profile: CustomerProfile) => {
    setLoading(true);
    try {
      // Find user account by phone number
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', profile.phone_number)
        .single();

      let orders = [];
      let totalSpent = 0;

      if (user) {
        // Fetch order history
        const { data: orderData } = await supabase
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
          .limit(10);

        orders = orderData || [];
        totalSpent = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
      }

      // Fetch call history
      const { data: callHistory } = await supabase
        .from('calls')
        .select('*')
        .eq('customer_number', profile.phone_number)
        .order('created_at', { ascending: false })
        .limit(5);

      // Calculate average satisfaction
      const callsWithSatisfaction = callHistory?.filter(call => call.satisfaction_score) || [];
      const avgSatisfaction = callsWithSatisfaction.length > 0
        ? callsWithSatisfaction.reduce((sum, call) => sum + (call.satisfaction_score || 0), 0) / callsWithSatisfaction.length
        : 0;

      setCustomerData({
        profile,
        user,
        orders,
        callHistory: (callHistory as Call[]) || [],
        totalSpent,
        avgSatisfaction
      });
    } catch (error) {
      console.error('Error fetching enhanced customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  if (!activeCall) {
    return (
      <Card className="h-full bg-sidebar border-sidebar-border">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-sidebar-foreground/60">
            <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No active call</p>
            <p className="text-xs text-muted-foreground mt-1">
              Customer information will appear when a call is active
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!customerProfile) {
    return (
      <Card className="h-full bg-sidebar border-sidebar-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-sidebar-foreground flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-sidebar-foreground">Unknown Customer</p>
              <p className="text-xs text-muted-foreground mt-1">
                No profile found for {activeCall.customer_number}
              </p>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => {
                // Could implement create customer profile functionality
                console.log('Create customer profile for:', activeCall.customer_number);
              }}
            >
              Create Customer Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-sidebar border-sidebar-border flex flex-col">
      <CardHeader className="pb-4 flex-shrink-0">
        <CardTitle className="text-sidebar-foreground flex items-center gap-2">
          <User className="h-5 w-5" />
          Customer Profile
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="profile" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
              <TabsTrigger value="orders" className="text-xs">Orders</TabsTrigger>
              <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="flex-1 mt-4 space-y-4">
              {/* Customer Overview */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {customerData.profile?.name || 'Unknown Customer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {customerData.profile?.phone_number}
                    </p>
                  </div>
                  {customerData.avgSatisfaction > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span className="text-xs">{customerData.avgSatisfaction.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Customer Stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <div className="text-lg font-bold text-primary">{customerData.callHistory.length}</div>
                    <div className="text-xs text-muted-foreground">Total Calls</div>
                  </div>
                  <div className="p-2 bg-muted/30 rounded text-center">
                    <div className="text-lg font-bold text-green-600">{formatCurrency(customerData.totalSpent)}</div>
                    <div className="text-xs text-muted-foreground">Total Spent</div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-2">
                  {customerData.profile?.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{customerData.profile.email}</span>
                    </div>
                  )}
                  
                  {customerData.profile?.preferred_language && (
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>{customerData.profile.preferred_language.toUpperCase()}</span>
                    </div>
                  )}

                  {customerData.profile?.timezone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{customerData.profile.timezone}</span>
                    </div>
                  )}

                  {customerData.profile?.last_interaction_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Last contact: {format(new Date(customerData.profile.last_interaction_at), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>

                {/* Customer Tags */}
                {customerData.profile?.tags && customerData.profile.tags.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      <span>Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {customerData.profile.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer Notes */}
                {customerData.profile?.customer_notes && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>Notes</span>
                    </div>
                    <div className="p-2 bg-muted/30 rounded text-sm">
                      {customerData.profile.customer_notes}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="orders" className="flex-1 mt-4">
              <ScrollArea className="h-full">
                {customerData.orders.length > 0 ? (
                  <div className="space-y-2">
                    {customerData.orders.map((order: any) => (
                      <div key={order.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">Order #{order.id.slice(-8)}</span>
                          <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs">
                            {order.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
                          <span className="font-medium">{formatCurrency(Number(order.total_amount))}</span>
                        </div>
                        {order.order_items && order.order_items.length > 0 && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Items: </span>
                            <span>
                              {order.order_items.map((item: any, idx: number) => (
                                <span key={item.id}>
                                  {item.product?.name || 'Unknown'}
                                  {idx < order.order_items.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No order history</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="flex-1 mt-4">
              <ScrollArea className="h-full">
                {customerData.callHistory.length > 0 ? (
                  <div className="space-y-2">
                    {customerData.callHistory.map((call: any) => (
                      <div key={call.id} className="p-3 bg-muted/30 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {format(new Date(call.created_at), 'MMM d, HH:mm')}
                          </span>
                          <Badge variant={getStatusBadgeVariant(call.call_status)} className="text-xs">
                            {call.call_status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Duration: {call.call_duration ? formatDuration(call.call_duration) : 'N/A'}</span>
                          {call.satisfaction_score && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span>{call.satisfaction_score}/5</span>
                            </div>
                          )}
                        </div>
                        {call.resolution_status && (
                          <Badge variant="outline" className="text-xs">
                            {call.resolution_status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No call history</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};