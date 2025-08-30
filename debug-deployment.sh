#!/bin/bash

# Debug Deployment Script for JD Sports AI Assistant
echo "🔍 Debugging JD Sports AI Assistant deployment..."

# Function to print colored output
print_status() {
    echo -e "\033[32m$1\033[0m"
}

print_error() {
    echo -e "\033[31m$1\033[0m"
}

print_warning() {
    echo -e "\033[33m$1\033[0m"
}

print_info() {
    echo -e "\033[36m$1\033[0m"
}

echo ""
print_info "=== STEP 1: Check Docker Status ==="
docker-compose ps

echo ""
print_info "=== STEP 2: Check Container Logs ==="
docker-compose logs --tail=20

echo ""
print_info "=== STEP 3: Check Port Usage ==="
echo "Checking what's using ports 8080 and 8443:"
sudo netstat -tulnp | grep :8080 || echo "Port 8080 is free"
sudo netstat -tulnp | grep :8443 || echo "Port 8443 is free"

echo ""
print_info "=== STEP 4: Get Server IP ==="
SERVER_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')
echo "Server IP: $SERVER_IP"

echo ""
print_info "=== STEP 5: Test HTTP Access ==="
echo "Testing HTTP on port 8080..."
if curl -f http://$SERVER_IP:8080/health > /dev/null 2>&1; then
    print_status "✅ HTTP health check successful"
    echo "Response: $(curl -s http://$SERVER_IP:8080/health)"
else
    print_error "❌ HTTP health check failed"
    echo "Trying to get more details..."
    curl -v http://$SERVER_IP:8080/health 2>&1 | head -10
fi

echo ""
print_info "=== STEP 6: Test HTTPS Access ==="
echo "Testing HTTPS on port 8443..."
if curl -f -k https://$SERVER_IP:8443/health > /dev/null 2>&1; then
    print_status "✅ HTTPS health check successful"
    echo "Response: $(curl -s -k https://$SERVER_IP:8443/health)"
else
    print_error "❌ HTTPS health check failed"
    echo "Trying to get more details..."
    curl -v -k https://$SERVER_IP:8443/health 2>&1 | head -10
fi

echo ""
print_info "=== STEP 7: Check SSL Certificates ==="
echo "Checking if SSL certificates exist in container..."
docker-compose exec jd-sports-ai-assistant ls -la /etc/nginx/ssl/ 2>/dev/null || echo "Cannot access container or SSL directory"

echo ""
print_info "=== STEP 8: Test Internal Container Health ==="
echo "Testing health check from inside container..."
docker-compose exec jd-sports-ai-assistant curl -s localhost/health 2>/dev/null || echo "Cannot access container"

echo ""
print_info "=== STEP 9: Check Firewall Status ==="
if command -v ufw &> /dev/null; then
    echo "UFW Status:"
    sudo ufw status
elif command -v firewall-cmd &> /dev/null; then
    echo "Firewalld Status:"
    sudo firewall-cmd --list-all
else
    echo "No firewall detected"
fi

echo ""
print_info "=== STEP 10: Summary ==="
echo "Your application should be accessible at:"
echo "  HTTP:  http://$SERVER_IP:8080"
echo "  HTTPS: https://$SERVER_IP:8443"
echo ""
echo "If HTTPS is not working, try:"
echo "  1. Check if container is running: docker-compose ps"
echo "  2. View logs: docker-compose logs -f"
echo "  3. Restart container: docker-compose restart"
echo "  4. Rebuild: docker-compose up -d --build"
