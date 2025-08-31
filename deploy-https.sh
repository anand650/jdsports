#!/bin/bash

# Deploy JD Sports AI Assistant with HTTPS Support
echo "🚀 Deploying JD Sports AI Assistant with HTTPS..."

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

# Check if domain is provided
if [ -z "$1" ]; then
    print_warning "⚠️  No domain provided. You can:"
    echo "   1. Provide a domain: ./deploy-https.sh your-domain.com"
    echo "   2. Use self-signed certificates for testing"
    echo ""
    read -p "Continue with self-signed certificates? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        DOMAIN=""
    else
        exit 1
    fi
else
    DOMAIN=$1
fi

# Setup SSL certificates
print_status "🔒 Setting up SSL certificates..."
chmod +x setup-ssl.sh

if [ -z "$DOMAIN" ]; then
    ./setup-ssl.sh
else
    ./setup-ssl.sh $DOMAIN
fi

if [ $? -ne 0 ]; then
    print_error "❌ SSL setup failed"
    exit 1
fi

# Stop existing containers
print_status "🛑 Stopping existing containers..."
docker-compose down

# Update firewall rules
print_status "🔥 Updating firewall rules..."
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    print_status "✅ UFW firewall rules updated"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --reload
    print_status "✅ Firewalld rules updated"
else
    print_warning "⚠️  Please manually open ports 80 and 443 in your firewall"
fi

# Build and start with HTTPS
print_status "🔨 Building and starting containers..."
docker-compose up -d --build

if [ $? -ne 0 ]; then
    print_error "❌ Docker deployment failed"
    exit 1
fi

# Wait for containers to start
print_status "⏳ Waiting for containers to start..."
sleep 15

# Health check
print_status "🏥 Performing health check..."

# Try HTTPS first
if [ ! -z "$DOMAIN" ]; then
    if curl -f -k https://$DOMAIN/health > /dev/null 2>&1; then
        print_status "✅ HTTPS deployment successful!"
        print_status "🌐 Access your application at: https://$DOMAIN"
        print_status "📊 Health check: https://$DOMAIN/health"
        print_status "🔒 SSL certificate: Active"
    else
        print_warning "⚠️  HTTPS health check failed, trying HTTP..."
        if curl -f http://$DOMAIN/health > /dev/null 2>&1; then
            print_status "✅ HTTP deployment successful (HTTPS may need time to propagate)"
            print_status "🌐 Access your application at: http://$DOMAIN (will redirect to HTTPS)"
        else
            print_error "❌ Health check failed. Checking logs..."
            docker-compose logs --tail=50
        fi
    fi
else
    # Use server IP for self-signed certificates
    SERVER_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')
    if curl -f -k https://$SERVER_IP/health > /dev/null 2>&1; then
        print_status "✅ HTTPS deployment successful!"
        print_status "🌐 Access your application at: https://$SERVER_IP"
        print_status "📊 Health check: https://$SERVER_IP/health"
        print_status "⚠️  Using self-signed certificates (browsers will show warnings)"
    else
        print_warning "⚠️  HTTPS health check failed, trying HTTP..."
        if curl -f http://$SERVER_IP/health > /dev/null 2>&1; then
            print_status "✅ HTTP deployment successful"
            print_status "🌐 Access your application at: http://$SERVER_IP"
        else
            print_error "❌ Health check failed. Checking logs..."
            docker-compose logs --tail=50
        fi
    fi
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

if [ ! -z "$DOMAIN" ]; then
    echo "   • Renew SSL: ./renew-ssl.sh"
fi


