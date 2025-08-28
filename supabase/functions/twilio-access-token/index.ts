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
    
    console.log('Account SID:', accountSid ? 'Set' : 'Missing');
    console.log('Auth Token:', authToken ? 'Set' : 'Missing');
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    const { identity = 'agent' } = await req.json();
    console.log('Generating token for identity:', identity);

    // Use a simpler approach - create the token manually
    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour

    const payload = {
      "iss": accountSid,
      "sub": accountSid,
      "nbf": now,
      "exp": now + ttl,
      "jti": `${accountSid}-${now}`,
      "grants": {
        "voice": {
          "incoming": {
            "allow": true
          },
          "outgoing": {
            "application_sid": "AP9a84c5966508822194825df93b35242f"
          }
        }
      }
    };

    // Create JWT manually using Twilio's format
    const header = {
      "cty": "twilio-fpa;v=1",
      "typ": "JWT",
      "alg": "HS256"
    };

    // Base64url encode
    const base64UrlEncode = (obj: any) => {
      return btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    const headerEncoded = base64UrlEncode(header);
    const payloadEncoded = base64UrlEncode(payload);
    
    // Create HMAC signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerEncoded}.${payloadEncoded}`);
    const key = encoder.encode(authToken);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const signatureArray = new Uint8Array(signature);
    
    // Convert signature to base64url
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    const token = `${headerEncoded}.${payloadEncoded}.${signatureBase64}`;
    
    console.log('Token generated successfully');

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