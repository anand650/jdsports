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
import { jwt } from "npm:twilio@5.8.1";

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

    const identity = "agent";

    console.log("Using Twilio's official AccessToken library...");

    // Create AccessToken using Twilio's official library
    const accessToken = new jwt.AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600 // 1 hour
    });

    // Create VoiceGrant for voice calls
    const voiceGrant = new jwt.AccessToken.VoiceGrant({
      incomingAllow: true,
      outgoingApplicationSid: appSid
    });

    // Add the voice grant to the token
    accessToken.addGrant(voiceGrant);

    // Generate the JWT token using Twilio's library
    const token = accessToken.toJwt();

    console.log("✓ JWT token generated successfully using Twilio's AccessToken library");
    console.log("Token length:", token.length);
    console.log("Identity:", identity);

    return new Response(
      JSON.stringify({ token, identity }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Error generating Twilio token:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
