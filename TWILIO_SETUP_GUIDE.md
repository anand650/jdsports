# 🔧 **Twilio Device Error (31000) - Complete Fix Guide**

## **🚨 Problem: Twilio Device Error 31000**

The error `UnknownError (31000): An unknown error has occurred` happens when:

1. **Missing Twilio credentials** in environment variables
2. **Invalid or expired access tokens**
3. **Network connectivity issues**
4. **Missing TwiML App configuration**

## **✅ Complete Fix Steps**

### **Step 1: Get Your Twilio Credentials**

1. **Go to [Twilio Console](https://console.twilio.com/)**
2. **Navigate to Settings → API Keys**
3. **Create a new API Key** (or use existing):
   - Click "Create API Key"
   - Name: `JD Sports AI Assistant`
   - Key Type: `Standard`
   - Save the **API Key SID** and **API Key Secret**

4. **Get your Account SID**:
   - Go to **Settings → General**
   - Copy your **Account SID**

### **Step 2: Create TwiML App**

1. **Go to [Twilio Console](https://console.twilio.com/)**
2. **Navigate to Voice → TwiML Apps**
3. **Create a new TwiML App**:
   - **Friendly Name**: `JD Sports AI Assistant`
   - **Voice Configuration**:
     - **Request URL**: `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-voice-webhook`
     - **HTTP Method**: `POST`
   - **Save and copy the TwiML App SID**

### **Step 3: Update Frontend Environment Variables**

Add these to your `vapi-aid/.env` file:

```bash
# Existing Supabase variables
VITE_SUPABASE_PROJECT_ID="wtradfuzjapqkowjpmew"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cmFkZnV6amFwcWtvd2pwbWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDA3MzAsImV4cCI6MjA3MTcxNjczMH0.qGx23xosw0NhvovbwSNSbclYk5MQ-RQikty87PJk7Mc"
VITE_SUPABASE_URL="https://wtradfuzjapqkowjpmew.supabase.co"

# Add these Twilio variables
VITE_TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
VITE_TWILIO_API_KEY="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
VITE_TWILIO_API_KEY_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
VITE_TWILIO_TWIML_APP_SID="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

### **Step 4: Update Supabase Environment Variables**

1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Select your project**: `wtradfuzjapqkowjpmew`
3. **Go to Settings → Environment Variables**
4. **Add these variables**:

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **Step 5: Deploy Supabase Functions**

```bash
# Navigate to your project
cd vapi-aid

# Deploy all functions
supabase functions deploy twilio-access-token
supabase functions deploy twilio-voice-webhook
supabase functions deploy twilio-audio-stream-v2
supabase functions deploy twilio-start-transcription
supabase functions deploy twilio-end-call
```

### **Step 6: Test the Fix**

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Open browser console** and check for:
   - ✅ "Twilio device ready"
   - ✅ "Device registered successfully"
   - ❌ No more "UnknownError (31000)"

3. **Test voice functionality**:
   - Try making a test call
   - Check if incoming calls work

## **🔍 Troubleshooting**

### **If Still Getting Error 31000:**

1. **Check Network Connectivity**:
   ```bash
   # Test Twilio connectivity
   curl -I https://api.twilio.com
   ```

2. **Verify Token Generation**:
   ```bash
   # Test the access token function
   curl -X POST https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-access-token \
     -H "Content-Type: application/json" \
     -d '{"identity": "agent"}'
   ```

3. **Check Browser Console**:
   - Look for CORS errors
   - Check if token is being received
   - Verify device initialization

### **Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| **CORS errors** | Ensure Supabase functions have proper CORS headers |
| **Invalid token** | Check API Key and Secret format |
| **Network timeout** | Check firewall/proxy settings |
| **TwiML App not found** | Verify TwiML App SID is correct |

### **Debug Mode:**

Add this to your browser console to see detailed Twilio logs:

```javascript
// Enable detailed Twilio logging
localStorage.setItem('twilio-debug', 'true');
```

## **✅ Success Indicators**

After fixing, you should see:

- ✅ **"Twilio device ready"** in console
- ✅ **"Device registered successfully"**
- ✅ **No more error 31000**
- ✅ **Voice calls work properly**
- ✅ **Incoming calls are received**

## **🔗 Important URLs**

- **Twilio Console**: https://console.twilio.com/
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Your Supabase Project**: https://wtradfuzjapqkowjpmew.supabase.co

## **📞 Next Steps**

After fixing the Twilio device error:

1. **Test voice calls** work properly
2. **Configure your phone number** webhooks
3. **Test the complete call flow**
4. **Deploy to production** with HTTPS

**This should completely resolve the Twilio device error 31000!** 🚀



