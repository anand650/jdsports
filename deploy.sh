#!/bin/bash

# JD Sports AI Assistant Deployment Script
# This script automates the deployment process on Hostinger VPS

set -e

echo "🚀 Starting JD Sports AI Assistant deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down --remove-orphans || true

# Remove old images
print_status "Cleaning up old images..."
docker system prune -f || true

# Build and start the application
print_status "Building and starting the application..."
docker-compose up --build -d

# Wait for the application to start
print_status "Waiting for application to start..."
sleep 10

# Check if the application is running
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "✅ Application is running successfully!"
    print_status "🌐 Access your application at: http://your-domain.com:3000"
    print_status "📊 Health check: http://your-domain.com:3000/health"
else
    print_error "❌ Application failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Show container status
print_status "Container status:"
docker-compose ps

# Show logs
print_status "Recent logs:"
docker-compose logs --tail=20

echo ""
print_status "🎉 Deployment completed successfully!"
print_status "📝 To view logs: docker-compose logs -f"
print_status "🛑 To stop: docker-compose down"
print_status "🔄 To restart: docker-compose restart"
