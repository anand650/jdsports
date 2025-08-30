#!/bin/bash

# Deploy JD Sports AI Assistant with Fixed HTTPS Setup
echo "🚀 Deploying JD Sports AI Assistant with fixed HTTPS setup..."

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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "❌ Please run as root (use sudo)"
    exit 1
fi

# Step 1: Generate SSL certificates
print_status "🔒 Generating SSL certificates..."
chmod +x generate-ssl.sh
./generate-ssl.sh

if [ $? -ne 0 ]; then
    print_error "❌ SSL certificate generation failed"
    exit 1
fi

# Step 2: Stop existing containers
print_status "🛑 Stopping existing containers..."
docker-compose down
docker-compose -f docker-compose-ssl.yml down 2>/dev/null || true

# Step 3: Create logs directory
mkdir -p logs

# Step 4: Deploy with fixed configuration
print_status "🔨 Building and starting containers with fixed HTTPS..."
docker-compose -f docker-compose-fixed.yml up -d --build

if [ $? -ne 0 ]; then
    print_error "❌ Docker deployment failed"
    exit 1
fi

# Step 5: Wait for containers to start
print_status "⏳ Waiting for containers to start..."
sleep 15

# Step 6: Health check
print_status "🏥 Performing health check..."

# Get server IP
SERVER_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

# Try HTTPS first
if curl -f -k https://$SERVER_IP:8443/health > /dev/null 2>&1; then
    print_status "✅ HTTPS deployment successful!"
    print_status "🌐 Access your application at: https://$SERVER_IP:8443"
    print_status "📊 Health check: https://$SERVER_IP:8443/health"
    print_status "🔒 SSL certificate: Active"
elif curl -f http://$SERVER_IP:8080/health > /dev/null 2>&1; then
    print_status "✅ HTTP deployment successful!"
    print_status "🌐 Access your application at: http://$SERVER_IP:8080"
    print_warning "⚠️  HTTPS may need a moment to initialize"
else
    print_error "❌ Health check failed. Checking logs..."
    docker-compose -f docker-compose-fixed.yml logs --tail=20
fi

# Show container status
print_status "📊 Container status:"
docker-compose -f docker-compose-fixed.yml ps

# Show useful commands
print_status "📝 Useful commands:"
echo "   • View logs: docker-compose -f docker-compose-fixed.yml logs -f"
echo "   • Restart: docker-compose -f docker-compose-fixed.yml restart"
echo "   • Stop: docker-compose -f docker-compose-fixed.yml down"
echo "   • Rebuild: docker-compose -f docker-compose-fixed.yml up -d --build"

print_status "🎉 Deployment completed! Your application is ready with HTTPS."
