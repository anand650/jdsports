import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID') || accountSid;
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET') || authToken;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    const { identity = 'agent' } = await req.json();

    // Create JWT token for Twilio Voice SDK
    const header = {
      "cty": "twilio-fpa;v=1",
      "typ": "JWT",
      "alg": "HS256"
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      "iss": apiKeySid,
      "sub": accountSid,
      "nbf": now,
      "exp": now + 3600, // 1 hour expiration
      "jti": `${apiKeySid}-${now}`,
      "aud": "twilio",
      "grants": {
        "voice": {
          "incoming": {
            "allow": true
          },
          "outgoing": {
            "application_sid": "APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" // You'll need to create a TwiML app
          }
        }
      }
    };

    // Simple JWT creation (for production, use a proper JWT library)
    const base64UrlEncode = (obj: any) => {
      return btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(header);
    const payloadEncoded = base64UrlEncode(payload);
    
    // Create signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(apiKeySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${headerEncoded}.${payloadEncoded}`)
    );
    
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const token = `${headerEncoded}.${payloadEncoded}.${signatureBase64}`;

    return new Response(
      JSON.stringify({ 
        token,
        identity 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating access token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});