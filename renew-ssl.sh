#!/bin/bash

# SSL Certificate Renewal Script for JD Sports AI Assistant
echo "🔄 Renewing SSL certificates..."

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

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    print_error "❌ Certbot is not installed. Please install it first."
    exit 1
fi

# Stop nginx temporarily for renewal
print_status "🛑 Stopping nginx temporarily for renewal..."
docker-compose exec jd-sports-ai-assistant nginx -s stop 2>/dev/null || true

# Renew certificates
print_status "🔐 Renewing SSL certificates..."
certbot renew --quiet --pre-hook "docker-compose down" --post-hook "docker-compose up -d"

RENEWAL_EXIT_CODE=$?

if [ $RENEWAL_EXIT_CODE -eq 0 ]; then
    # Copy renewed certificates if they exist
    DOMAIN=$(ls /etc/letsencrypt/live/ | head -1)
    if [ ! -z "$DOMAIN" ] && [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        print_status "📋 Copying renewed certificates..."
        cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
        cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
        
        # Set proper permissions
        chmod 644 ssl/cert.pem
        chmod 600 ssl/key.pem
        
        # Restart containers to pick up new certificates
        print_status "🔄 Restarting containers with new certificates..."
        docker-compose restart
        
        # Wait for restart
        sleep 10
        
        # Health check
        print_status "🏥 Performing health check..."
        if curl -f -k https://$DOMAIN/health > /dev/null 2>&1; then
            print_status "✅ SSL certificates renewed and deployed successfully!"
            print_status "🔒 Certificate valid for: $DOMAIN"
            
            # Show certificate expiry
            EXPIRY=$(openssl x509 -in ssl/cert.pem -noout -enddate | cut -d= -f2)
            print_status "📅 Certificate expires: $EXPIRY"
        else
            print_error "❌ Health check failed after renewal"
            docker-compose logs --tail=20
        fi
    else
        print_warning "⚠️  No domain found for certificate copying"
    fi
else
    print_warning "⚠️  Certificate renewal not needed or failed"
fi

# Restart nginx
print_status "🔄 Starting nginx..."
docker-compose up -d

print_status "✅ SSL renewal process completed!"

# Show next renewal date
print_status "📅 Next renewal check:"
certbot certificates


