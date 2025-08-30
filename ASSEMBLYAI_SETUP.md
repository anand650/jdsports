# 🎤 AssemblyAI Setup for Live Transcription

The JD Sports AI Assistant uses AssemblyAI's Universal-Streaming model for real-time speech-to-text transcription during calls. This provides ultra-low latency (~300ms) and improved accuracy.

## 📋 Prerequisites

1. **AssemblyAI Account**: Sign up at [assemblyai.com](https://www.assemblyai.com/)
2. **API Key**: Get your API key from the AssemblyAI dashboard
3. **Supabase Project**: Your Supabase project should be configured

## 🔑 Step 1: Get AssemblyAI API Key

1. Go to [AssemblyAI Dashboard](https://app.assemblyai.com/)
2. Sign up or log in to your account
3. Navigate to **API Keys** section
4. Copy your **API Key** (starts with something like `ced0df76d7fa4ecbabe510040d07a69e`)

## 🔧 Step 2: Configure Supabase Environment Variables

### Option A: Using Supabase Dashboard

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Edge Functions**
4. Add the following environment variable:
   - **Key**: `ASSEMBLYAI_API_KEY`
   - **Value**: Your AssemblyAI API key

### Option B: Using Supabase CLI

```bash
# Set the environment variable
supabase secrets set ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Deploy the updated function
supabase functions deploy twilio-audio-stream-v2
```

## 🚀 Step 3: Deploy the Function

After setting the environment variable, redeploy the function:

```bash
# Deploy the function with new environment variables
supabase functions deploy twilio-audio-stream-v2
```

## ✅ Step 4: Test the Setup

1. Make a test call to your application
2. Check the function logs in Supabase Dashboard
3. Look for these success messages:
   - `🔌 Connecting to AssemblyAI Universal-Streaming...`
   - `✅ AssemblyAI WebSocket connected!`
   - `💬 Transcript: [your speech]`

## 🛠️ Troubleshooting

### Error: "401 Unauthorized"
- **Cause**: Invalid or expired API key
- **Solution**: Check your AssemblyAI API key and ensure it's correct

### Error: "Token request failed"
- **Cause**: API key not set or invalid
- **Solution**: Verify the environment variable is set correctly

### Error: "Connection timeout"
- **Cause**: Network issues or AssemblyAI service down
- **Solution**: Check your internet connection and AssemblyAI status

## 💰 AssemblyAI Pricing

AssemblyAI offers:
- **Free Tier**: 3 hours of audio processing per month
- **Paid Plans**: Starting from $0.25 per hour
- **Real-time Transcription**: Included in all plans

## 🔒 Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Regularly rotate your API keys
- Monitor your AssemblyAI usage

## 📞 Support

If you encounter issues:
1. Check [AssemblyAI Documentation](https://docs.assemblyai.com/)
2. Verify your API key in the AssemblyAI dashboard
3. Check Supabase function logs for detailed error messages
4. Ensure your Supabase project has the correct environment variables

## 🎉 Success!

Once configured, your JD Sports AI Assistant will:
- ✅ Transcribe calls in real-time
- ✅ Save transcripts to the database
- ✅ Generate AI suggestions based on customer speech
- ✅ Provide live call monitoring
