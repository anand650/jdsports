#!/bin/bash

# SSL Setup Script for JD Sports AI Assistant
echo "🔒 Setting up SSL certificates for JD Sports AI Assistant..."

# Create SSL directory
mkdir -p ssl

# Check if domain is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your domain name"
    echo "Usage: ./setup-ssl.sh your-domain.com"
    echo ""
    echo "💡 If you don't have a domain, you can:"
    echo "   1. Use your server's IP address"
    echo "   2. Generate self-signed certificates for testing"
    echo ""
    read -p "Generate self-signed certificates for testing? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔧 Generating self-signed certificates..."
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout ssl/key.pem \
            -out ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost"
        
        echo "✅ Self-signed certificates generated!"
        echo "⚠️  Note: Browsers will show security warnings with self-signed certificates"
        echo "🔗 Your site will be available at: https://your-server-ip"
        exit 0
    else
        exit 1
    fi
fi

DOMAIN=$1

echo "🎯 Setting up SSL for domain: $DOMAIN"

# Install certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    
    # Detect OS and install certbot
    if [ -f /etc/debian_version ]; then
        apt-get update
        apt-get install -y certbot
    elif [ -f /etc/redhat-release ]; then
        yum install -y certbot || dnf install -y certbot
    else
        echo "❌ Unsupported OS. Please install certbot manually."
        exit 1
    fi
fi

# Stop any service using port 80
echo "🛑 Stopping services on port 80..."
systemctl stop nginx 2>/dev/null || true
systemctl stop apache2 2>/dev/null || true
docker stop $(docker ps -q --filter "publish=80") 2>/dev/null || true

# Get SSL certificate
echo "🔐 Getting SSL certificate from Let's Encrypt..."
certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

if [ $? -eq 0 ]; then
    # Copy certificates to project directory
    echo "📋 Copying certificates..."
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem ssl/cert.pem
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem ssl/key.pem
    
    # Set proper permissions
    chmod 644 ssl/cert.pem
    chmod 600 ssl/key.pem
    
    echo "✅ SSL certificates set up successfully!"
    echo "🔗 Your site will be available at: https://$DOMAIN"
    echo "📝 Don't forget to update your DNS to point to this server"
else
    echo "❌ Failed to get SSL certificate from Let's Encrypt"
    echo "💡 Generating self-signed certificates as fallback..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=$DOMAIN"
    
    echo "✅ Self-signed certificates generated!"
    echo "⚠️  Note: Browsers will show security warnings with self-signed certificates"
fi


