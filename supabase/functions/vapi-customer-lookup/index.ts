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
    
    // Extract phone number from VAPI call data
    const phoneNumber = message?.call?.customer?.number || message?.phoneNumber;
    const email = message?.parameters?.email;
    const orderId = message?.parameters?.orderId;
    
    console.log('VAPI Customer Lookup:', { phoneNumber, email, orderId });

    let customerData = null;

    // Try different lookup methods
    if (phoneNumber) {
      customerData = await lookupByPhone(phoneNumber);
    } else if (email) {
      customerData = await lookupByEmail(email);
    } else if (orderId) {
      customerData = await lookupByOrderId(orderId);
    }

    const response = {
      result: customerData ? formatCustomerData(customerData) : null,
      message: customerData 
        ? `Found customer information for ${customerData.name || customerData.email}`
        : "No customer information found. I can help you look up your details using your email or order ID."
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in vapi-customer-lookup:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to lookup customer information',
      message: "I'm having trouble accessing customer information right now. Please provide your email or order ID."
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
  
  const { data: orderData } = await supabase
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
    
  return orderData;
}

function formatCustomerData(customerData: any) {
  const formatted = {
    name: customerData.name || customerData.full_name || customerData.userData?.full_name,
    email: customerData.email || customerData.userData?.email,
    phone: customerData.phone_number || customerData.userData?.phone_number,
    totalOrders: 0,
    recentOrders: [],
    callHistory: customerData.call_history_count || 0,
    lastInteraction: customerData.last_interaction_at,
    preferredLanguage: customerData.preferred_language || 'en',
    customerNotes: customerData.customer_notes,
    tags: customerData.tags || []
  };

  // Add order information if available
  if (customerData.order_items) {
    formatted.recentOrders = [{
      id: customerData.id,
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