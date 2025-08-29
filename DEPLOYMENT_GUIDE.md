# 🚀 JD Sports AI Assistant - Hostinger VPS Deployment Guide

This guide will walk you through deploying your JD Sports AI Assistant on a Hostinger VPS using Docker.

## 📋 Prerequisites

- Hostinger VPS with Ubuntu 20.04+ or CentOS 8+
- SSH access to your VPS
- Domain name (optional but recommended)
- Basic knowledge of Linux commands

## 🛠️ Step 1: Connect to Your VPS

```bash
ssh root@your-vps-ip
```

## 🔧 Step 2: Update System and Install Dependencies

### For Ubuntu/Debian:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### For CentOS/RHEL:
```bash
# Update system
sudo yum update -y

# Install required packages
sudo yum install -y curl wget git unzip yum-utils
```

## 🐳 Step 3: Install Docker

### For Ubuntu/Debian:
```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
sudo usermod -aG docker $USER
```

### For CentOS/RHEL:
```bash
# Add Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
sudo usermod -aG docker $USER
```

## 🔧 Step 4: Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

## 📁 Step 5: Upload Your Application

### Option A: Using Git (Recommended)
```bash
# Clone your repository
git clone https://github.com/your-username/your-repo.git
cd your-repo
```

### Option B: Using SCP/SFTP
```bash
# From your local machine, upload the project
scp -r ./vapi-aid root@your-vps-ip:/root/
```

## 🔐 Step 6: Configure Environment Variables

```bash
# Create environment file
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

## 🚀 Step 7: Deploy the Application

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## 🌐 Step 8: Configure Domain (Optional)

### Option A: Direct Domain Access (Recommended)
Simply point your domain's A record to your VPS IP address. The Docker container will handle everything.

### Option B: Using External Nginx as Reverse Proxy (Advanced)
If you need additional features like SSL termination or multiple domains, you can install nginx on the host:

```bash
# Install Nginx
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/jd-sports-ai
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/jd-sports-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Note:** This is optional. The Docker setup already includes nginx and handles everything automatically.

## 🔒 Step 9: Configure Firewall

```bash
# Install UFW (Ubuntu) or configure iptables (CentOS)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 9090/tcp  # HTTP (JD Sports AI)
sudo ufw enable
```

## 📊 Step 10: Monitor Your Application

```bash
# View logs
docker-compose logs -f

# Check container status
docker-compose ps

# Monitor system resources
docker stats
```

## 🔄 Step 11: Set Up Automatic Updates (Optional)

Create a cron job for automatic updates:
```bash
# Edit crontab
crontab -e

# Add this line for daily updates at 2 AM
0 2 * * * cd /root/your-repo && ./deploy.sh >> /var/log/deployment.log 2>&1
```

## 🛠️ Troubleshooting

### Common Issues:

1. **Port already in use:**
```bash
# Check what's using port 80
sudo netstat -tulpn | grep :80
# Kill the process or change port in docker-compose.yml
```

2. **Permission denied:**
```bash
# Logout and login again after adding user to docker group
exit
# SSH back in
```

3. **Application not starting:**
```bash
# Check logs
docker-compose logs
# Check if environment variables are set correctly
```

4. **SSL Certificate Issues:**
```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 📈 Performance Optimization

1. **Enable Gzip compression** (already configured in nginx.conf)
2. **Set up CDN** for static assets
3. **Configure caching** (already configured)
4. **Monitor resource usage** with `docker stats`

## 🔄 Updating Your Application

```bash
# Pull latest changes
git pull origin main

# Redeploy
./deploy.sh
```

## 📞 Support

If you encounter any issues:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure all ports are open in your firewall
4. Check Hostinger VPS status and resources

## 🎉 Congratulations!

Your JD Sports AI Assistant is now running on Hostinger VPS! 

**Access your application at:** `http://your-domain.com:9090` or `http://your-vps-ip:9090`

**Health check:** `http://your-domain.com:9090/health`
