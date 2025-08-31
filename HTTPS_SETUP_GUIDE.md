# 🔒 HTTPS Setup Guide for JD Sports AI Assistant

This guide will help you deploy your JD Sports AI Assistant with HTTPS support to fix webhook and production issues.

## 🎯 **Why HTTPS is Required**

- **Twilio webhooks** require HTTPS in production
- **Browser security** blocks mixed HTTP/HTTPS content
- **Production security** standards require encrypted connections
- **Webhook reliability** improves with HTTPS

## 🚀 **Quick Start (Recommended)**

### **Option 1: With Custom Domain**

```bash
# Make scripts executable
chmod +x setup-ssl.sh deploy-https.sh renew-ssl.sh

# Deploy with your domain
sudo ./deploy-https.sh your-domain.com
```

### **Option 2: Self-Signed Certificates (Testing)**

```bash
# Make scripts executable
chmod +x setup-ssl.sh deploy-https.sh renew-ssl.sh

# Deploy with self-signed certificates
sudo ./deploy-https.sh
```

## 📋 **Prerequisites**

- ✅ **Root access** to your server
- ✅ **Docker and Docker Compose** installed
- ✅ **Domain name** (optional, can use IP with self-signed certs)
- ✅ **Ports 80 and 443** open in firewall
- ✅ **DNS pointing** to your server (if using domain)

## 🔧 **Manual Setup Steps**

### **Step 1: Prepare the Environment**

```bash
# Navigate to project directory
cd vapi-aid

# Make scripts executable
chmod +x setup-ssl.sh
chmod +x deploy-https.sh
chmod +x renew-ssl.sh
```

### **Step 2: Setup SSL Certificates**

**For production with domain:**
```bash
sudo ./setup-ssl.sh your-domain.com
```

**For testing without domain:**
```bash
sudo ./setup-ssl.sh
```

### **Step 3: Deploy with HTTPS**

```bash
# Stop existing containers
docker-compose down

# Deploy with HTTPS
sudo ./deploy-https.sh your-domain.com
```

### **Step 4: Update Firewall**

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

## ✅ **Verification Steps**

### **1. Check HTTPS Access**

```bash
# Test HTTPS health check
curl -k https://your-domain.com/health

# Test application access
curl -I https://your-domain.com
```

### **2. Verify SSL Certificate**

```bash
# Check certificate details
openssl x509 -in ssl/cert.pem -noout -text

# Check certificate expiry
openssl x509 -in ssl/cert.pem -noout -enddate
```

### **3. Test Webhook Endpoints**

```bash
# Test Supabase functions (should work now)
curl -X POST https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-voice-webhook
```

## 📱 **Update Twilio Configuration**

After HTTPS is working, make sure your Twilio phone number uses HTTPS URLs:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active numbers**
3. Click on your phone number
4. Update **Voice Configuration**:
   - **Webhook URL**: `https://wtradfuzjapqkowjpmew.supabase.co/functions/v1/twilio-voice-webhook`
   - **HTTP Method**: POST

## 🔄 **SSL Certificate Renewal**

### **Automatic Renewal (Recommended)**

```bash
# Add to crontab for automatic renewal
sudo crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * /path/to/your/project/vapi-aid/renew-ssl.sh
```

### **Manual Renewal**

```bash
# Renew certificates manually
sudo ./renew-ssl.sh
```

## 🎯 **Access URLs**

After successful deployment:

- **HTTPS**: `https://your-domain.com` or `https://your-server-ip`
- **Health Check**: `https://your-domain.com/health`
- **HTTP**: Automatically redirects to HTTPS

## 🛠️ **Troubleshooting**

### **Issue: Certificate Error**

```bash
# Check if certificates exist
ls -la ssl/

# Regenerate self-signed certificates
sudo ./setup-ssl.sh
```

### **Issue: Port Already in Use**

```bash
# Stop conflicting services
sudo systemctl stop nginx
sudo systemctl stop apache2

# Check what's using the ports
sudo netstat -tulnp | grep :80
sudo netstat -tulnp | grep :443
```

### **Issue: Let's Encrypt Failed**

```bash
# Check if domain points to server
nslookup your-domain.com

# Try manual certificate generation
sudo certbot certonly --manual -d your-domain.com
```

### **Issue: Docker Build Failed**

```bash
# Check Docker logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose up -d --build
```

### **Issue: Health Check Failed**

```bash
# Check container status
docker-compose ps

# View application logs
docker-compose logs -f jd-sports-ai-assistant

# Test internal health check
docker-compose exec jd-sports-ai-assistant curl localhost/health
```

## 📊 **Monitoring**

### **Check SSL Certificate Status**

```bash
# View certificate information
sudo certbot certificates

# Check certificate expiry
openssl x509 -in ssl/cert.pem -noout -enddate
```

### **Monitor Application Health**

```bash
# Continuous health monitoring
watch -n 30 'curl -s -o /dev/null -w "%{http_code}" https://your-domain.com/health'

# View real-time logs
docker-compose logs -f
```

## 🔒 **Security Best Practices**

1. **Keep certificates updated** - Set up automatic renewal
2. **Use strong passwords** - For any administrative access
3. **Regular backups** - Backup your SSL certificates
4. **Monitor logs** - Watch for suspicious activity
5. **Firewall rules** - Only open necessary ports

## 📝 **Useful Commands**

```bash
# View container status
docker-compose ps

# View logs
docker-compose logs -f

# Restart application
docker-compose restart

# Stop application
docker-compose down

# Rebuild and start
docker-compose up -d --build

# Check SSL certificate
openssl x509 -in ssl/cert.pem -noout -text

# Test HTTPS connectivity
curl -I https://your-domain.com

# Renew SSL certificates
sudo ./renew-ssl.sh
```

## 🎉 **Success Indicators**

- ✅ **HTTPS URL works** without certificate errors
- ✅ **HTTP redirects** to HTTPS automatically
- ✅ **Health check** returns "healthy"
- ✅ **Webhook calls** reach your server (not Lovable)
- ✅ **Browser shows** secure lock icon
- ✅ **SSL certificate** is valid and not expired

## 🆘 **Support**

If you encounter issues:

1. **Check the logs**: `docker-compose logs -f`
2. **Verify certificates**: `openssl x509 -in ssl/cert.pem -noout -text`
3. **Test connectivity**: `curl -I https://your-domain.com`
4. **Check firewall**: Ensure ports 80 and 443 are open
5. **Verify DNS**: Make sure your domain points to the server


