#!/bin/bash

# Simple VPS Update Script for B&R Driver App
# Run this on your VPS after git pushing from your laptop

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🚀 Updating B&R Driver App..."
echo "=============================="

# Get current directory
CURRENT_DIR=$(pwd)
BACKUP_DIR="${CURRENT_DIR}_backup_$(date +%Y%m%d_%H%M%S)"

print_status "Current directory: $CURRENT_DIR"

# Create backup of current app
print_status "Creating backup..."
cp -r "$CURRENT_DIR" "$BACKUP_DIR"
print_success "Backup created at: $BACKUP_DIR"

# Preserve important files
print_status "Preserving uploads and environment files..."
if [ -d "public/uploads" ]; then
    cp -r public/uploads /tmp/uploads_backup
    print_success "Uploads backed up"
fi

if [ -f ".env.production" ]; then
    cp .env.production /tmp/env_backup
    print_success "Environment file backed up"
elif [ -f ".env" ]; then
    cp .env /tmp/env_backup
    print_success "Environment file backed up"
fi

# Pull latest changes from git
print_status "Pulling latest changes from git..."
git pull origin main || git pull origin master
print_success "Latest code pulled"

# Install dependencies (including dev dependencies for build)
print_status "Installing dependencies..."
npm ci

# Build the application
print_status "Building application..."
npm run build

# Run database migrations
print_status "Running database migrations..."
npx prisma db push || print_warning "Database push failed"

# Restore preserved files
print_status "Restoring uploads and environment files..."
if [ -d "/tmp/uploads_backup" ]; then
    rm -rf public/uploads
    mv /tmp/uploads_backup public/uploads
    print_success "Uploads restored"
fi

if [ -f "/tmp/env_backup" ]; then
    if [ -f ".env.production" ]; then
        mv /tmp/env_backup .env.production
    else
        mv /tmp/env_backup .env
    fi
    print_success "Environment file restored"
fi

# Reload PM2 application (zero-downtime)
print_status "Reloading PM2 application..."
pm2 reload br-driver-app || pm2 restart br-driver-app
print_success "Application reloaded"

# Health check
print_status "Running health check..."
sleep 3

if curl -f -s http://localhost:3000/api/health > /dev/null; then
    print_success "✅ Health check passed - Application is running correctly"
    
    # Clean up old backup after successful update
    print_status "Cleaning up old backup..."
    rm -rf "$BACKUP_DIR"
    print_success "Cleanup completed"
    
else
    print_error "❌ Health check failed - Rolling back..."
    
    # Stop current app
    pm2 stop br-driver-app || true
    
    # Restore from backup
    rm -rf "$CURRENT_DIR"
    mv "$BACKUP_DIR" "$CURRENT_DIR"
    cd "$CURRENT_DIR"
    
    # Restart with old version
    pm2 start ecosystem.config.js --env production || pm2 restart br-driver-app
    
    print_error "Rollback completed - please check the logs"
    exit 1
fi

# Save PM2 configuration
pm2 save

print_success "🎉 Update completed successfully!"
print_status "Application is running at: http://localhost:3000"
print_status "Check status: pm2 status"
print_status "View logs: pm2 logs br-driver-app"