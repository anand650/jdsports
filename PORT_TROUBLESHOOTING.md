# 🔧 Port Troubleshooting Guide

## **Issue: Port Already in Use**

If you get this error:
```
Bind for 0.0.0.0:8080 failed: port is already allocated
```

## **Quick Fix: Use Different Ports**

The configuration has been updated to use:
- **HTTP**: Port 8080 (instead of 80)
- **HTTPS**: Port 8443 (instead of 443)

## **Current Port Configuration**

```yaml
ports:
  - "8080:80"   # HTTP
  - "8443:443"  # HTTPS
```

## **Access URLs**

- **HTTPS**: `https://your-server-ip:8443`
- **HTTP**: `http://your-server-ip:8080`
- **Health Check**: `https://your-server-ip:8443/health`

## **If Ports 8080/8443 Are Also in Use**

### **Option 1: Check What's Using the Ports**

```bash
# Check what's using port 8080
sudo netstat -tulnp | grep :8080

# Check what's using port 8443
sudo netstat -tulnp | grep :8443
```

### **Option 2: Stop Conflicting Services**

```bash
# Stop nginx if running
sudo systemctl stop nginx

# Stop apache if running
sudo systemctl stop apache2

# Stop any other web servers
sudo systemctl stop lighttpd
```

### **Option 3: Use Different Ports**

Edit `docker-compose.yml` and change the ports:

```yaml
ports:
  - "9090:80"   # HTTP on port 9090
  - "9443:443"  # HTTPS on port 9443
```

Then access at:
- **HTTPS**: `https://your-server-ip:9443`
- **HTTP**: `http://your-server-ip:9090`

### **Option 4: Kill Process Using the Port**

```bash
# Find process ID using port 8080
sudo lsof -i :8080

# Kill the process (replace PID with actual process ID)
sudo kill -9 PID
```

## **Firewall Configuration**

Make sure your firewall allows the new ports:

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow 8080/tcp
sudo ufw allow 8443/tcp

# Firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8443/tcp
sudo firewall-cmd --reload
```

## **Deploy Again**

After fixing the port issue:

```bash
# Stop containers
docker-compose down

# Start with new configuration
docker-compose up -d --build
```

## **Verify Deployment**

```bash
# Check container status
docker-compose ps

# Test health check
curl -k https://your-server-ip:8443/health

# View logs
docker-compose logs -f
```

## **Common Port Conflicts**

- **Port 80**: Usually used by nginx, apache, or other web servers
- **Port 443**: Usually used by SSL-enabled web servers
- **Port 8080**: Sometimes used by Jenkins, Tomcat, or other applications
- **Port 8443**: Sometimes used by alternative HTTPS services

## **Success Indicators**

- ✅ **Container starts** without port errors
- ✅ **Health check** returns "healthy"
- ✅ **HTTPS access** works on port 8443
- ✅ **HTTP access** works on port 8080



