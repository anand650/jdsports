# 🚀 Automatic HTTPS Deployment Guide

This guide shows you how to deploy your JD Sports AI Assistant with **automatic HTTPS** - no manual SSL setup required!

## 🎯 **What's Automatic**

- ✅ **SSL certificates** generated automatically
- ✅ **HTTPS configuration** handled by Docker
- ✅ **HTTP to HTTPS redirect** built-in
- ✅ **No manual certificate management** needed
- ✅ **Works with any domain or IP address**

## 🚀 **Quick Start (One Command)**

```bash
# Just run this one command!
docker-compose up -d --build
```

That's it! Your application will be available with HTTPS automatically.

## 📋 **Prerequisites**

- ✅ **Docker and Docker Compose** installed
- ✅ **Ports 8080 and 8443** open in firewall
- ✅ **Server access** (VPS, local machine, etc.)

## 🔧 **Deployment Options**

### **Option 1: Simple Docker Compose (Recommended)**

```bash
# Navigate to project directory
cd vapi-aid

# Deploy with automatic HTTPS
docker-compose up -d --build
```

### **Option 2: Using the Auto-Deploy Script**

```bash
# Make script executable
chmod +x deploy-auto.sh

# Run automatic deployment
./deploy-auto.sh
```

### **Option 3: Manual Steps**

```bash
# Stop any existing containers
docker-compose down

# Build and start with HTTPS
docker-compose up -d --build

# Check status
docker-compose ps
```

## ✅ **Verification**

After deployment, your application will be available at:

- **HTTPS**: `https://your-server-ip:8443` or `https://your-domain.com:8443`
- **HTTP**: `http://your-server-ip:8080` (redirects to HTTPS)
- **Health Check**: `https://your-server-ip:8443/health`

## 🔒 **SSL Certificate Details**

- **Type**: Self-signed certificate (auto-generated)
- **Validity**: 365 days
- **Auto-renewal**: Built into container startup
- **Browser warnings**: Normal for self-signed certificates

## 🛠️ **Troubleshooting**

### **Port Already in Use**

```bash
# Check what's using the ports
sudo netstat -tulnp | grep :8080
sudo netstat -tulnp | grep :8443

# Stop conflicting services
sudo systemctl stop nginx
sudo systemctl stop apache2

# Or use different ports by editing docker-compose.yml
```

### **Docker Build Failed**

```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose down
docker-compose up -d --build
```

### **Health Check Failed**

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Restart container
docker-compose restart
```

## 📱 **Update Twilio Configuration**

After deployment, update your Twilio phone number webhook:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active numbers**
3. Click on your phone number
4. Update **Voice Configuration**:
   - **Webhook URL**: `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-voice-webhook`
   - **HTTP Method**: POST

## 📝 **Useful Commands**

```bash
# View logs
docker-compose logs -f

# Restart application
docker-compose restart

# Stop application
docker-compose down

# Rebuild and start
docker-compose up -d --build

# Check container status
docker-compose ps
```

## 🎉 **Success Indicators**

- ✅ **HTTPS URL works** (with browser security warning)
- ✅ **HTTP redirects** to HTTPS automatically
- ✅ **Health check** returns "healthy"
- ✅ **Container status** shows "Up"
- ✅ **No manual SSL setup** required

## 🔄 **Updates and Maintenance**

### **Update Application**

```bash
# Pull latest code and rebuild
git pull
docker-compose up -d --build
```

### **View Real-time Logs**

```bash
# Monitor application logs
docker-compose logs -f
```

### **Restart Application**

```bash
# Restart without rebuilding
docker-compose restart
```

## 🆘 **Support**

If you encounter issues:

1. **Check logs**: `docker-compose logs -f`
2. **Verify ports**: Ensure 80 and 443 are open
3. **Check Docker**: Make sure Docker is running
4. **Rebuild**: `docker-compose up -d --build`

## 🎯 **What Happens Automatically**

1. **Container starts** with nginx and openssl
2. **SSL certificates** are generated automatically
3. **Nginx configuration** is applied with HTTPS
4. **Application** becomes available on both HTTP and HTTPS
5. **Health checks** confirm everything is working

**No manual SSL setup required!** 🚀
