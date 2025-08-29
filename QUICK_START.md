# 🚀 Quick Start - JD Sports AI Assistant Deployment

## 📦 Files Created for Deployment

✅ **Dockerfile** - Multi-stage build for production
✅ **nginx.conf** - Optimized web server configuration  
✅ **docker-compose.yml** - Container orchestration
✅ **deploy.sh** - Automated deployment script
✅ **setup-vps.sh** - VPS initial setup script
✅ **.dockerignore** - Optimized build context

## 🎯 Quick Deployment Steps

### 1. **On Your VPS (Fresh Ubuntu/CentOS)**

```bash
# Connect to your VPS
ssh root@your-vps-ip

# Upload and run setup script
chmod +x setup-vps.sh
./setup-vps.sh

# Logout and login again
exit
ssh root@your-vps-ip
```

### 2. **Upload Your Application**

```bash
# Option A: Using Git
git clone https://github.com/your-username/your-repo.git
cd your-repo

# Option B: Using SCP (from your local machine)
scp -r ./vapi-aid root@your-vps-ip:/root/
```

### 3. **Configure Environment**

```bash
# Create .env file
nano .env
```

Add your environment variables:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_TWILIO_ACCOUNT_SID=your_twilio_account_sid
VITE_TWILIO_AUTH_TOKEN=your_twilio_auth_token
VITE_VAPI_API_KEY=your_vapi_api_key
```

### 4. **Deploy**

```bash
# Run deployment
./deploy.sh
```

### 5. **Access Your Application**

🌐 **URL:** `http://your-vps-ip:3000` or `http://your-domain.com:3000`
📊 **Health Check:** `http://your-vps-ip:3000/health`

## 🔧 Management Commands

```bash
# View logs
docker-compose logs -f

# Restart application
docker-compose restart

# Stop application
docker-compose down

# Update and redeploy
git pull && ./deploy.sh
```

## 📋 What's Included

- **Production-ready Docker setup** with built-in nginx
- **Optimized nginx configuration** inside Docker container
- **Automatic deployment script**
- **Health monitoring**
- **SSL ready (add your certificates)**
- **Performance optimizations**
- **Security headers**

## 🎉 You're Ready!

Your JD Sports AI Assistant is now running on Hostinger VPS with:
- ✅ Docker containerization
- ✅ Nginx web server
- ✅ Automatic restarts
- ✅ Health monitoring
- ✅ Performance optimization
- ✅ Security configuration

For detailed instructions, see `DEPLOYMENT_GUIDE.md`
