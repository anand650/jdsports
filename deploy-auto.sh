#!/bin/bash

# Automatic Deployment Script for JD Sports AI Assistant
echo "🚀 Deploying JD Sports AI Assistant with automatic HTTPS..."

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

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Stop existing containers
print_status "🛑 Stopping existing containers..."
docker-compose down

# Create logs directory
mkdir -p logs

# Build and start containers
print_status "🔨 Building and starting containers..."
docker-compose up -d --build

if [ $? -ne 0 ]; then
    print_error "❌ Docker deployment failed"
    exit 1
fi

# Wait for containers to start
print_status "⏳ Waiting for containers to start..."
sleep 10

# Health check
print_status "🏥 Performing health check..."

# Get server IP
SERVER_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')

# Try HTTPS first
if curl -f -k https://$SERVER_IP/health > /dev/null 2>&1; then
    print_status "✅ HTTPS deployment successful!"
    print_status "🌐 Access your application at: https://$SERVER_IP"
    print_status "📊 Health check: https://$SERVER_IP/health"
    print_status "🔒 SSL certificate: Auto-generated"
elif curl -f http://$SERVER_IP/health > /dev/null 2>&1; then
    print_status "✅ HTTP deployment successful!"
    print_status "🌐 Access your application at: http://$SERVER_IP"
    print_warning "⚠️  HTTPS may need a moment to initialize"
else
    print_error "❌ Health check failed. Checking logs..."
    docker-compose logs --tail=20
fi

# Show container status
print_status "📊 Container status:"
docker-compose ps

# Show useful commands
print_status "📝 Useful commands:"
echo "   • View logs: docker-compose logs -f"
echo "   • Restart: docker-compose restart"
echo "   • Stop: docker-compose down"
echo "   • Rebuild: docker-compose up -d --build"

print_status "🎉 Deployment completed! Your application is ready with automatic HTTPS."
