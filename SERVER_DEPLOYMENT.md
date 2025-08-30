# 🚀 Server Deployment Guide with HTTPS (Simple & Working)

## **Quick Deployment on Server**

### **Step 1: Upload Files to Server**

```bash
# Upload the entire project folder
scp -r ./vapi-aid root@195.35.45.87:/root/
```

### **Step 2: SSH into Server**

```bash
ssh root@195.35.45.87
```

### **Step 3: Navigate to Project**

```bash
cd /root/vapi-aid
```

### **Step 4: Deploy with Simple SSL**

```bash
# Make scripts executable
chmod +x generate-ssl.sh
chmod +x deploy-simple-ssl.sh

# Deploy with simple SSL configuration
sudo ./deploy-simple-ssl.sh
```

## **What This Does**

1. ✅ **Generates SSL certificates** for your server IP
2. ✅ **Uses simple Dockerfile** that works with nginx:alpine
3. ✅ **Mounts certificates** into the Docker container
4. ✅ **Starts nginx** with HTTPS configuration
5. ✅ **Performs health checks** to verify everything works

## **Access URLs**

After deployment, your application will be available at:

- **HTTPS**: `https://195.35.45.87:8443`
- **HTTP**: `http://195.35.45.87:8080` (redirects to HTTPS)
- **Health Check**: `https://195.35.45.87:8443/health`

## **Files Created**

- `generate-ssl.sh` - Generates SSL certificates
- `deploy-simple-ssl.sh` - Simple deployment script
- `docker-compose-simple-ssl.yml` - Docker config with simple SSL
- `Dockerfile-simple-ssl` - Simple Dockerfile without entrypoint conflicts
- `ssl/` - Directory containing certificates

## **Troubleshooting**

### **If HTTPS Still Doesn't Work**

```bash
# Check container logs
docker-compose -f docker-compose-simple-ssl.yml logs -f

# Check SSL certificates
ls -la ssl/

# Test HTTPS manually
curl -k https://195.35.45.87:8443/health
```

### **Manual SSL Generation**

If the script fails, generate certificates manually:

```bash
# Create SSL directory
mkdir -p ssl

# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=JD Sports/OU=AI Assistant/CN=195.35.45.87" \
    -addext "subjectAltName=DNS:195.35.45.87,IP:195.35.45.87,IP:127.0.0.1,IP:0.0.0.0"

# Set permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem

# Deploy with simple configuration
docker-compose -f docker-compose-simple-ssl.yml up -d --build
```

## **Success Indicators**

- ✅ **Container status** shows "Up"
- ✅ **HTTPS health check** returns "healthy"
- ✅ **Browser access** works (with security warning)
- ✅ **Twilio webhooks** will work with HTTPS

## **For Twilio Configuration**

After HTTPS is working, update your Twilio phone number webhook:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active numbers**
3. Click on your phone number
4. Update **Voice Configuration**:
   - **Webhook URL**: `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-voice-webhook`
   - **HTTP Method**: POST

## **What Was Fixed**

- ✅ **Entrypoint conflicts** - Uses simple Dockerfile without custom entrypoints
- ✅ **SSL certificate mounting** - Proper volume mounting
- ✅ **Nginx configuration** - HTTPS with HTTP redirect
- ✅ **Container startup** - Uses default nginx entrypoint

## **Why This Works**

- ✅ **No custom entrypoints** - Uses nginx:alpine's default entrypoint
- ✅ **SSL certificates mounted** - Available at `/etc/nginx/ssl/`
- ✅ **Nginx config** - Handles HTTPS and HTTP redirect
- ✅ **Simple approach** - Less complexity, more reliability

**Your webhooks should now work with HTTPS!** 🚀
