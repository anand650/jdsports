#!/usr/bin/env node

/**
 * Test Twilio Configuration
 * This script helps diagnose Twilio device error 31000
 */

const https = require('https');

console.log('🔧 Testing Twilio Configuration...\n');

// Test 1: Check if we can reach Twilio API
console.log('1️⃣ Testing Twilio API connectivity...');
https.get('https://api.twilio.com', (res) => {
  console.log(`   ✅ Twilio API reachable (Status: ${res.statusCode})`);
  
  // Test 2: Check access token endpoint
  console.log('\n2️⃣ Testing access token endpoint...');
  testAccessToken();
}).on('error', (err) => {
  console.log(`   ❌ Cannot reach Twilio API: ${err.message}`);
  console.log('   💡 Check your internet connection and firewall settings');
});

function testAccessToken() {
  const postData = JSON.stringify({ identity: 'agent' });
  
  const options = {
    hostname: 'wtradfuzjapqkowjpmew.supabase.co',
    port: 443,
    path: '/functions/v1/twilio-access-token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`   📊 Response Status: ${res.statusCode}`);
      
      try {
        const response = JSON.parse(data);
        
        if (response.token) {
          console.log('   ✅ Access token generated successfully');
          console.log(`   📏 Token length: ${response.token.length} characters`);
          console.log(`   🆔 Identity: ${response.identity}`);
          
          // Test 3: Validate token format
          console.log('\n3️⃣ Validating token format...');
          if (response.token.startsWith('eyJ')) {
            console.log('   ✅ Token format is valid JWT');
          } else {
            console.log('   ❌ Token format is invalid (should start with "eyJ")');
          }
          
        } else if (response.error) {
          console.log(`   ❌ Token generation failed: ${response.error}`);
          console.log('   💡 Check your Supabase environment variables');
        } else {
          console.log('   ❌ Unexpected response format');
          console.log('   📄 Response:', data);
        }
        
      } catch (parseError) {
        console.log('   ❌ Failed to parse response');
        console.log('   📄 Raw response:', data);
      }
      
      // Test 4: Check environment variables
      console.log('\n4️⃣ Checking environment variables...');
      checkEnvironmentVariables();
    });
  });

  req.on('error', (err) => {
    console.log(`   ❌ Request failed: ${err.message}`);
  });

  req.write(postData);
  req.end();
}

function checkEnvironmentVariables() {
  console.log('   📋 Required environment variables:');
  console.log('   • TWILIO_ACCOUNT_SID (should start with "AC")');
  console.log('   • TWILIO_API_KEY (should start with "SK")');
  console.log('   • TWILIO_API_KEY_SECRET (32 characters)');
  console.log('   • TWILIO_TWIML_APP_SID (should start with "AP")');
  console.log('\n   💡 These should be set in your Supabase project settings');
}

console.log('\n📋 Summary of tests:');
console.log('• Test 1: Twilio API connectivity');
console.log('• Test 2: Access token generation');
console.log('• Test 3: Token format validation');
console.log('• Test 4: Environment variable checklist');
console.log('\n🔍 Check the results above to identify the issue!');



