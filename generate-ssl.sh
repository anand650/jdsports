#!/bin/bash

# Generate SSL Certificates for JD Sports AI Assistant
echo "🔒 Generating SSL certificates for HTTPS..."

# Create SSL directory
mkdir -p ssl

# Generate SSL certificates for the server with proper settings for Twilio
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=US/ST=State/L=City/O=JD Sports/OU=AI Assistant/CN=195.35.45.87" \
    -addext "subjectAltName=DNS:195.35.45.87,IP:195.35.45.87,IP:127.0.0.1,IP:0.0.0.0" \
    -addext "keyUsage=digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth"

# Set proper permissions
chmod 644 ssl/cert.pem
chmod 600 ssl/key.pem

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificates saved in: ssl/cert.pem and ssl/key.pem"
echo "🔐 Certificate details:"
openssl x509 -in ssl/cert.pem -noout -text | grep -E "(Subject:|DNS:|IP Address:|Not Before|Not After)"

# Verify certificate
echo "🔍 Verifying certificate..."
openssl verify -CAfile ssl/cert.pem ssl/cert.pem

echo "🚀 SSL certificates are ready for deployment!"
