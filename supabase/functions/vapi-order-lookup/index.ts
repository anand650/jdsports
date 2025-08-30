import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    
    const orderId = message?.parameters?.orderId;
    const email = message?.parameters?.email;
    
    console.log('VAPI Order Lookup:', { orderId, email });

    let orders = [];

    if (orderId) {
      const order = await getOrderById(orderId);
      if (order) orders = [order];
    } else if (email) {
      orders = await getOrdersByEmail(email);
    }

    const response = {
      result: orders.map(formatOrderData),
      count: orders.length,
      message: orders.length > 0 
        ? orders.length === 1 
          ? `Found your order ${orders[0].order_number || '#' + orders[0].id.slice(-8)}`
          : `Found ${orders.length} orders for ${email}`
        : `Sorry, I couldn't find any orders ${orderId ? `with ID ${orderId}` : email ? `for ${email}` : ''}. Please check your order ID or email address.`
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vapi-order-lookup:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to lookup order information',
      message: "I'm having trouble accessing order information right now. Please provide your order ID or email address."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getOrderById(orderId: string) {
  console.log('Getting order by ID:', orderId);
  
  // First try to find by order_number (JD1, JD2, etc.)
  let { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        products (*)
      ),
      users (*)
    `)
    .eq('order_number', orderId)
    .single();

  // If not found by order_number, try by UUID (for backward compatibility)
  if (error && error.code === 'PGRST116') {
    console.log('Order not found by order_number, trying UUID...');
    const result = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (*)
        ),
        users (*)
      `)
      .eq('id', orderId)
      .single();
    
    data = result.data;
    error = result.error;
  }
    
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getOrdersByEmail(email: string) {
  console.log('Getting orders by email:', email);
  
  // First get the user ID
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();
    
  if (!userData) return [];
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        *,
        products (*)
      ),
      users (*)
    `)
    .eq('user_id', userData.id)
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) throw error;
  return data || [];
}

function formatOrderData(order: any) {
  return {
    id: order.id,
    orderNumber: order.order_number || `ORD-${order.id.slice(-8)}`,
    status: order.status,
    total: order.total_amount,
    totalFormatted: `$${parseFloat(order.total_amount).toFixed(2)}`,
    created: new Date(order.created_at).toLocaleDateString(),
    updated: new Date(order.updated_at).toLocaleDateString(),
    shippingAddress: order.shipping_address,
    customer: {
      name: order.users?.full_name,
      email: order.users?.email
    },
    items: order.order_items?.map((item: any) => ({
      id: item.id,
      productName: item.products?.name,
      quantity: item.quantity,
      price: item.price,
      priceFormatted: `$${parseFloat(item.price).toFixed(2)}`,
      size: item.size,
      color: item.color,
      product: {
        category: item.products?.category,
        brand: item.products?.brand,
        description: item.products?.description
      }
    })) || [],
    itemCount: order.order_items?.length || 0,
    statusMessage: getStatusMessage(order.status)
  };
}

function getStatusMessage(status: string) {
  switch (status) {
    case 'pending':
      return 'Your order is being processed';
    case 'confirmed':
      return 'Your order has been confirmed and is being prepared';
    case 'shipped':
      return 'Your order has been shipped and is on the way';
    case 'delivered':
      return 'Your order has been delivered';
    case 'cancelled':
      return 'Your order has been cancelled';
    default:
      return `Order status: ${status}`;
  }
}