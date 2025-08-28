// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// };

// serve(async (req) => {
//   // Handle CORS preflight requests
//   if (req.method === 'OPTIONS') {
//     return new Response(null, { headers: corsHeaders });
//   }

//   try {
//     const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
//     const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    
//     console.log('Account SID:', accountSid ? 'Set' : 'Missing');
//     console.log('Auth Token:', authToken ? 'Set' : 'Missing');
    
//     if (!accountSid || !authToken) {
//       throw new Error('Twilio credentials not configured');
//     }

//     const { identity = 'agent' } = await req.json();
//     console.log('Generating token for identity:', identity);

//     // Create proper JWT token for Twilio Voice SDK
//     const now = Math.floor(Date.now() / 1000);
//     const ttl = 3600; // 1 hour

//     // Twilio Voice SDK requires specific JWT format
//     const header = {
//       "typ": "JWT",
//       "alg": "HS256",
//       "cty": "twilio-fpa;v=1"
//     };

//     const payload = {
//       "iss": accountSid,
//       "sub": accountSid,
//       "nbf": now,
//       "exp": now + ttl,
//       "jti": `${accountSid}-${now}`,
//       "grants": {
//         "identity": identity,
//         "voice": {
//           "incoming": {
//             "allow": true
//           },
//           "outgoing": {
//             "application_sid": "AP9a84c5966508822194825df93b35242f"
//           }
//         }
//       }
//     };

//     // Base64url encode function
//     const base64UrlEncode = (str: string) => {
//       return btoa(str)
//         .replace(/\+/g, '-')
//         .replace(/\//g, '_')
//         .replace(/=/g, '');
//     };

//     // Encode header and payload
//     const headerEncoded = base64UrlEncode(JSON.stringify(header));
//     const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    
//     // Create HMAC-SHA256 signature
//     const message = `${headerEncoded}.${payloadEncoded}`;
//     const encoder = new TextEncoder();
//     const key = await crypto.subtle.importKey(
//       'raw',
//       encoder.encode(authToken),
//       { name: 'HMAC', hash: 'SHA-256' },
//       false,
//       ['sign']
//     );
    
//     const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
//     const signatureBase64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

//     const token = `${message}.${signatureBase64}`;
    
//     console.log('JWT token generated successfully for identity:', identity);

//     return new Response(
//       JSON.stringify({ 
//         token,
//         identity 
//       }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
//     );

//   } catch (error) {
//     console.error('Error generating access token:', error);
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       {
//         status: 500,
//         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
//       }
//     );
//   }
// });

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Set allowed origins — you can lock this down to your domain
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle browser preflight (CORS check)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKey = Deno.env.get("TWILIO_API_KEY");
    const apiSecret = Deno.env.get("TWILIO_API_SECRET");
    const appSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    if (!accountSid || !apiKey || !apiSecret || !appSid) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const identity = "agent";
    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour

    // Create JWT payload for Twilio Voice
    const payload = {
      iss: apiKey,
      sub: accountSid,
      nbf: now,
      exp: now + ttl,
      jti: `${apiKey}-${now}`,
      grants: {
        identity: identity,
        voice: {
          incoming: { allow: true },
          outgoing: { application_sid: appSid }
        }
      }
    };

    // Base64url encode function
    const base64UrlEncode = (str: string) => {
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    };

    // Create JWT header
    const header = {
      alg: "HS256",
      typ: "JWT"
    };

    // Encode header and payload
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    
    // Create HMAC-SHA256 signature
    const message = `${headerEncoded}.${payloadEncoded}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    const signatureBase64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));

    const token = `${message}.${signatureBase64}`;

    return new Response(
      JSON.stringify({ token, identity }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error generating Twilio token:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
