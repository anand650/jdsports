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
    const body = await req.json().catch(() => ({}));
    const { message = {} } = body;
    
    // Enhanced parameter extraction with multiple fallback paths
    const phoneNumber = message?.call?.customer?.number || 
                       message?.call?.from || 
                       message?.phoneNumber || 
                       message?.phone || 
                       message?.parameters?.phone ||
                       body.phoneNumber ||
                       body.phone;
                       
    const email = message?.parameters?.email || 
                 message?.email || 
                 message?.customer?.email ||
                 body.email;
                 
    const orderId = message?.parameters?.orderId || 
                   message?.parameters?.order_id || 
                   message?.orderId ||
                   body.orderId;
    
    console.log('VAPI Customer Lookup:', { phoneNumber, email, orderId, rawMessage: message });

    let customerData = null;
    let searchMethod = null;
    let searchAttempted = false;

    // Try different lookup methods with validation and error handling
    if (phoneNumber && typeof phoneNumber === 'string' && phoneNumber.trim()) {
      searchMethod = 'phone';
      searchAttempted = true;
      console.log('Attempting customer lookup by phone:', phoneNumber);
      try {
        customerData = await lookupByPhone(phoneNumber.trim());
      } catch (error) {
        console.error('Error looking up customer by phone:', error);
      }
    }
    
    if (!customerData && email && typeof email === 'string' && email.trim()) {
      searchMethod = 'email';
      searchAttempted = true;
      console.log('Attempting customer lookup by email:', email);
      try {
        customerData = await lookupByEmail(email.trim());
      } catch (error) {
        console.error('Error looking up customer by email:', error);
      }
    }
    
    if (!customerData && orderId && typeof orderId === 'string' && orderId.trim()) {
      searchMethod = 'orderId';
      searchAttempted = true;
      console.log('Attempting customer lookup by order ID:', orderId);
      try {
        customerData = await lookupByOrderId(orderId.trim());
        if (customerData) {
          // Extract customer data from order data
          customerData = customerData.users || customerData;
        }
      } catch (error) {
        console.error('Error looking up customer by order ID:', error);
      }
    }

    const response = {
      result: customerData ? formatCustomerData(customerData) : null,
      searchMethod,
      searchAttempted,
      parameters: { phoneNumber, email, orderId },
      message: generateCustomerResponseMessage(customerData, { phoneNumber, email, orderId }, searchAttempted)
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vapi-customer-lookup:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to lookup customer information',
      message: "I'm having trouble accessing customer information right now. Could you please provide your email address or order number? This will help me look up your account details and assist you better.",
      suggestion: "Try saying 'My email is customer@example.com' or 'My order number is JD1'"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function lookupByPhone(phoneNumber: string) {
  console.log('Looking up by phone:', phoneNumber);
  
  // Try customer_profiles first (call center data)
  const { data: profileData } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();
  
  if (profileData) {
    // Get associated user data if exists
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();
    
    return { ...profileData, userData };
  }

  // Try users table
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();
    
  return userData;
}

async function lookupByEmail(email: string) {
  console.log('Looking up by email:', email);
  
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
    
  if (userData) {
    // Get customer profile if exists
    const { data: profileData } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('email', email)
      .single();
      
    return { ...userData, profileData };
  }
  
  return null;
}

async function lookupByOrderId(orderId: string) {
  console.log('Looking up by order ID:', orderId);
  
  // First try by order_number (JD1, JD2, etc.)
  let { data: orderData } = await supabase
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

  // If not found by order_number, try by UUID
  if (!orderData) {
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
    
    orderData = result.data;
  }
    
  return orderData;
}

function generateCustomerResponseMessage(customerData: any, params: any, searchAttempted: boolean) {
  if (customerData) {
    const name = customerData.name || customerData.full_name || customerData.userData?.full_name;
    const email = customerData.email || customerData.userData?.email;
    return `Found customer information for ${name || email || 'this account'}. How can I help you today?`;
  } else if (searchAttempted) {
    const { phoneNumber, email, orderId } = params;
    if (phoneNumber || email || orderId) {
      return `I couldn't find customer information with the provided details. Please verify your ${phoneNumber ? 'phone number' : email ? 'email address' : 'order number'} or try a different lookup method.`;
    }
  }
  
  return "I can help you look up your account details using your email address or order number. Could you please provide one of these?";
}

function formatCustomerData(customerData: any) {
  const formatted = {
    name: customerData?.name || customerData?.full_name || customerData?.userData?.full_name || 'Unknown',
    email: customerData?.email || customerData?.userData?.email || 'Not provided',
    phone: customerData?.phone_number || customerData?.userData?.phone_number || 'Not provided',
    totalOrders: customerData?.total_orders || 0,
    totalSpent: customerData?.total_spent || 0,
    loyaltyTier: customerData?.loyalty_tier || 'bronze',
    recentOrders: [],
    callHistory: customerData?.call_history_count || 0,
    lastInteraction: customerData?.last_interaction_at || null,
    preferredLanguage: customerData?.preferred_language || 'en',
    customerNotes: customerData?.customer_notes || '',
    tags: customerData?.tags || [],
    communicationPreference: customerData?.communication_preference || 'email'
  };

  // Add order information if available
  if (customerData.order_items) {
    formatted.recentOrders = [{
      id: customerData.order_number || customerData.id,
      status: customerData.status,
      total: customerData.total_amount,
      items: customerData.order_items.map((item: any) => ({
        product: item.products?.name,
        quantity: item.quantity,
        price: item.price
      }))
    }];
  }

  return formatted;
}