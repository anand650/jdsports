# 🔧 Troubleshooting Guide

## **Issue: HTTPS Not Working**

If `https://your-server-ip:8443` is not working, follow these steps:

## **Step 1: Run Debug Script**

```bash
# Make debug script executable
chmod +x debug-deployment.sh

# Run debug script
./debug-deployment.sh
```

This will check:
- ✅ Docker container status
- ✅ Container logs
- ✅ Port usage
- ✅ HTTP/HTTPS connectivity
- ✅ SSL certificates
- ✅ Firewall status

## **Step 2: Check Container Status**

```bash
# Check if container is running
docker-compose ps

# View container logs
docker-compose logs -f
```

## **Step 3: Common Issues & Solutions**

### **Issue 1: Container Not Starting**

```bash
# Check logs for errors
docker-compose logs

# Rebuild container
docker-compose down
docker-compose up -d --build
```

### **Issue 2: Port Already in Use**

```bash
# Check what's using the ports
sudo netstat -tulnp | grep :8080
sudo netstat -tulnp | grep :8443

# Stop conflicting services
sudo systemctl stop nginx
sudo systemctl stop apache2
```

### **Issue 3: SSL Certificate Issues**

The HTTPS might not work due to SSL certificate generation issues. Try the simple HTTP version:

```bash
# Use simple configuration (HTTP only)
docker-compose -f docker-compose-simple.yml up -d --build
```

Then access at: `http://your-server-ip:8080`

### **Issue 4: Firewall Blocking**

```bash
# Allow ports in firewall
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp

# Or for firewalld
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --reload
```

## **Step 4: Alternative Solutions**

### **Option A: HTTP Only (Recommended for Testing)**

```bash
# Stop current containers
docker-compose down

# Use simple configuration
docker-compose -f docker-compose-simple.yml up -d --build
```

Access at: `http://your-server-ip:8080`

### **Option B: Different Ports**

Edit `docker-compose.yml` and change ports:

```yaml
ports:
  - "9090:80"   # HTTP on port 9090
  - "9443:443"  # HTTPS on port 9443
```

### **Option C: Manual SSL Setup**

If automatic SSL isn't working, you can:

1. **Generate SSL certificates manually:**
   ```bash
   mkdir -p ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
       -keyout ssl/key.pem \
       -out ssl/cert.pem \
       -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
   ```

2. **Mount certificates in docker-compose.yml:**
   ```yaml
   volumes:
     - ./logs:/var/log/nginx
     - ./ssl:/etc/nginx/ssl
   ```

## **Step 5: Test Connectivity**

### **Test HTTP (Port 8080)**
```bash
curl http://your-server-ip:8080/health
```

### **Test HTTPS (Port 8443)**
```bash
curl -k https://your-server-ip:8443/health
```

### **Test from Browser**
- HTTP: `http://your-server-ip:8080`
- HTTPS: `https://your-server-ip:8443` (may show security warning)

## **Step 6: Verify Success**

### **Success Indicators**
- ✅ Container status shows "Up"
- ✅ Health check returns "healthy"
- ✅ Can access application in browser
- ✅ No errors in container logs

### **For Webhook Testing**
Even with HTTP only, you can test if the issue is resolved:
- Your Supabase functions should still work
- Twilio webhooks to Supabase should work
- The main issue was likely the Docker deployment, not HTTPS specifically

## **Step 7: Get Help**

If still having issues:

1. **Run debug script:** `./debug-deployment.sh`
2. **Check logs:** `docker-compose logs -f`
3. **Try simple config:** `docker-compose -f docker-compose-simple.yml up -d --build`
4. **Share debug output** for further assistance

## **Quick Commands Reference**

```bash
# Debug deployment
./debug-deployment.sh

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose up -d --build

# Use simple config (HTTP only)
docker-compose -f docker-compose-simple.yml up -d --build

# Stop all
docker-compose down
```
