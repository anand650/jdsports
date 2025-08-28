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
    const apiSecret = Deno.env.get("TWILIO_API_KEY_SECRET");
    const appSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    console.log("Credential check:");
    console.log("TWILIO_ACCOUNT_SID:", accountSid ? "✓ Present" : "✗ Missing");
    console.log("TWILIO_API_KEY:", apiKey ? "✓ Present" : "✗ Missing");
    console.log("TWILIO_API_KEY_SECRET:", apiSecret ? "✓ Present" : "✗ Missing");
    console.log("TWILIO_TWIML_APP_SID:", appSid ? "✓ Present" : "✗ Missing");

    // Log actual values (first few chars only for security)
    console.log("Account SID starts with:", accountSid?.substring(0, 6));
    console.log("API Key starts with:", apiKey?.substring(0, 6));
    console.log("App SID starts with:", appSid?.substring(0, 6));

    if (!accountSid || !apiKey || !apiSecret || !appSid) {
      console.error("Missing Twilio credentials - function will fail");
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const identity = "agent";
    const now = Math.floor(Date.now() / 1000);
    const ttl = 3600; // 1 hour
    const timeBuffer = 30; // 30 second buffer for clock skew

    // Create JWT payload for Twilio Voice
    const payload = {
      iss: apiKey,
      sub: accountSid,
      nbf: now - timeBuffer, // Add buffer to account for clock skew
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

    // Validate credential formats
    if (!accountSid?.startsWith('AC')) {
      console.error("Invalid Account SID format - should start with 'AC'");
      return new Response(
        JSON.stringify({ error: "Invalid Account SID format" }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    if (!apiKey?.startsWith('SK')) {
      console.error("Invalid API Key format - should start with 'SK'");
      return new Response(
        JSON.stringify({ error: "Invalid API Key format" }),
        { status: 500, headers: corsHeaders }
      );
    }
    
    if (!appSid?.startsWith('AP')) {
      console.error("Invalid TwiML App SID format - should start with 'AP'");
      return new Response(
        JSON.stringify({ error: "Invalid TwiML App SID format" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log("JWT Payload structure:", JSON.stringify(payload, null, 2));

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
    
    console.log("JWT Header (encoded):", headerEncoded);
    console.log("JWT Payload (encoded):", payloadEncoded);
    
    // Create HMAC-SHA256 signature
    const message = `${headerEncoded}.${payloadEncoded}`;
    console.log("Message to sign:", message);
    console.log("API Secret length:", apiSecret?.length);
    
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    
    // Convert ArrayBuffer -> base64url safely
    const signatureArray = new Uint8Array(signature);
    
    // Convert bytes to binary string safely
    let binary = "";
    for (let i = 0; i < signatureArray.length; i++) {
      binary += String.fromCharCode(signatureArray[i]);
    }
    
    // Encode to base64url
    const signatureBase64 = btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, ""); // strip padding
    
    console.log("Signature (base64url):", signatureBase64.substring(0, 10) + "...");

    const token = `${message}.${signatureBase64}`;
    console.log("Complete JWT length:", token.length);

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
