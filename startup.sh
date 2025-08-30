#!/bin/bash

# Automatic HTTPS Startup Script for JD Sports AI Assistant
echo "🚀 Starting JD Sports AI Assistant with automatic HTTPS setup..."

# Function to print colored output
print_status() {
    echo -e "\033[32m$1\033[0m"
}

print_warning() {
    echo -e "\033[33m$1\033[0m"
}

# Create SSL directory
mkdir -p /etc/nginx/ssl

# Check if SSL certificates already exist
if [ ! -f "/etc/nginx/ssl/cert.pem" ] || [ ! -f "/etc/nginx/ssl/key.pem" ]; then
    print_status "🔒 Generating SSL certificates..."
    
    # Generate self-signed certificate for automatic HTTPS
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/key.pem \
        -out /etc/nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=JD Sports/OU=AI Assistant/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"
    
    # Set proper permissions
    chmod 644 /etc/nginx/ssl/cert.pem
    chmod 600 /etc/nginx/ssl/key.pem
    
    print_status "✅ SSL certificates generated successfully!"
    print_warning "⚠️  Using self-signed certificates (browsers will show warnings)"
else
    print_status "✅ SSL certificates already exist"
fi

# Create logs directory
mkdir -p /var/log/nginx

# Test nginx configuration
print_status "🔧 Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    print_status "✅ Nginx configuration is valid"
    
    # Start nginx
    print_status "🌐 Starting nginx with HTTPS support..."
    nginx -g "daemon off;"
else
    print_warning "❌ Nginx configuration test failed"
    print_warning "🔧 Starting nginx with default configuration..."
    
    # Fallback to default nginx configuration
    cp /etc/nginx/nginx.conf.default /etc/nginx/nginx.conf 2>/dev/null || true
    nginx -g "daemon off;"
fi
