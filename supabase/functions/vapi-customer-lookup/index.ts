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

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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

    // Use AI to normalize and complete inputs if they seem incomplete or malformed
    const normalizedInputs = await normalizeInputsWithAI({ phoneNumber, email, orderId });

    let customerData = null;
    let searchMethod = null;
    let searchAttempted = false;

    // Try different lookup methods with validation and error handling
    // Use normalized inputs for better matching
    const finalPhoneNumber = normalizedInputs.phoneNumber || phoneNumber;
    const finalEmail = normalizedInputs.email || email;
    const finalOrderId = normalizedInputs.orderId || orderId;
    
    if (finalPhoneNumber && typeof finalPhoneNumber === 'string' && finalPhoneNumber.trim()) {
      searchMethod = 'phone';
      searchAttempted = true;
      console.log('Attempting customer lookup by phone:', finalPhoneNumber, normalizedInputs.phoneNumber ? '(AI normalized)' : '');
      try {
        customerData = await lookupByPhone(finalPhoneNumber.trim());
      } catch (error) {
        console.error('Error looking up customer by phone:', error);
      }
    }
    
    if (!customerData && finalEmail && typeof finalEmail === 'string' && finalEmail.trim()) {
      searchMethod = 'email';
      searchAttempted = true;
      console.log('Attempting customer lookup by email:', finalEmail, normalizedInputs.email ? '(AI normalized)' : '');
      try {
        customerData = await lookupByEmail(finalEmail.trim());
      } catch (error) {
        console.error('Error looking up customer by email:', error);
      }
    }
    
    if (!customerData && finalOrderId && typeof finalOrderId === 'string' && finalOrderId.trim()) {
      searchMethod = 'orderId';
      searchAttempted = true;
      console.log('Attempting customer lookup by order ID:', finalOrderId, normalizedInputs.orderId ? '(AI normalized)' : '');
      try {
        customerData = await lookupByOrderId(finalOrderId.trim());
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
      parameters: { phoneNumber: finalPhoneNumber, email: finalEmail, orderId: finalOrderId },
      originalParameters: { phoneNumber, email, orderId },
      normalizedInputs: normalizedInputs,
      message: generateCustomerResponseMessage(customerData, { phoneNumber: finalPhoneNumber, email: finalEmail, orderId: finalOrderId }, searchAttempted)
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
  const { data: profileData, error: profileError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('phone_number', phoneNumber)
    .maybeSingle();
  
  if (profileError) {
    console.error('Error looking up customer profile:', profileError);
  }
  
  if (profileData) {
    // Get associated user data if exists
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    return { ...profileData, userData };
  }

  // Try users table
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('phone_number', phoneNumber)
    .maybeSingle();
    
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
  
  // First try by order_number (JD1, JD2, etc.) - case insensitive
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
    .ilike('order_number', orderId)
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

async function normalizeInputsWithAI(inputs: { phoneNumber?: string; email?: string; orderId?: string }) {
  if (!openAIApiKey) {
    console.log('No OpenAI API key found, skipping AI normalization');
    return { phoneNumber: null, email: null, orderId: null };
  }

  try {
    const prompt = `You are a data normalization assistant. Given user inputs that might be incomplete or malformed, normalize them to proper formats.

Input data:
- Phone number: "${inputs.phoneNumber || 'none'}"
- Email: "${inputs.email || 'none'}"
- Order ID: "${inputs.orderId || 'none'}"

Rules:
1. Phone numbers: Add country code if missing (default +91 for India), format properly
2. Emails: Fix common typos, add missing domains if obvious (e.g., "customer1 at s" → "customer1@s.com")
3. Order IDs: Convert to proper format (e.g., "jt1" → "JD1", "j d 1" → "JD1")

Return ONLY a JSON object with normalized values or null if unable to normalize:
{
  "phoneNumber": "normalized phone or null",
  "email": "normalized email or null", 
  "orderId": "normalized order ID or null"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      return { phoneNumber: null, email: null, orderId: null };
    }

    const data = await response.json();
    const normalizedText = data.choices[0].message.content.trim();
    
    try {
      const normalized = JSON.parse(normalizedText);
      console.log('AI normalized inputs:', normalized);
      return normalized;
    } catch (parseError) {
      console.error('Failed to parse AI response:', normalizedText);
      return { phoneNumber: null, email: null, orderId: null };
    }
  } catch (error) {
    console.error('Error in AI normalization:', error);
    return { phoneNumber: null, email: null, orderId: null };
  }
}