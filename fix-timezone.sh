#!/bin/bash

# Quick Timezone Fix for B&R Driver App
# Run this on your VPS to fix the timezone issue immediately

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_status "🕐 Fixing timezone issue for B&R Driver App..."

# Step 1: Set server timezone to PST
print_status "Setting server timezone to PST (America/Los_Angeles)..."
sudo timedatectl set-timezone America/Los_Angeles

# Verify timezone change
CURRENT_TZ=$(timedatectl show --property=Timezone --value)
if [ "$CURRENT_TZ" = "America/Los_Angeles" ]; then
    print_success "✅ Server timezone set to PST/PDT"
    print_status "Current time: $(date)"
else
    print_error "❌ Failed to set timezone. Current: $CURRENT_TZ"
    exit 1
fi

# Step 2: Restart PM2 application to pick up timezone change
print_status "Restarting B&R Driver App to apply timezone changes..."

if pm2 list | grep -q "br-driver-app.*online"; then
    pm2 restart br-driver-app
    print_success "✅ Application restarted"
else
    print_warning "⚠️  Application not found in PM2. You may need to start it manually."
fi

# Step 3: Wait for app to start
print_status "Waiting for application to start..."
sleep 5

# Step 4: Test the application
print_status "Testing application health..."
if curl -f -s "http://localhost:3000" > /dev/null 2>&1; then
    print_success "✅ Application is running and healthy"
else
    print_warning "⚠️  Application may not be fully started yet. Check with: pm2 logs br-driver-app"
fi

print_success "🎉 Timezone fix completed!"
echo ""
print_status "=== Summary ==="
print_status "• Server timezone: $(timedatectl show --property=Timezone --value)"
print_status "• Current server time: $(date)"
print_status "• Application status: $(pm2 list | grep br-driver-app | awk '{print $10}' || echo 'Not found')"
echo ""
print_status "Your San Francisco client should now see routes with correct dates!"
print_status "Routes uploaded 'today' will now appear as today in PST timezone."
echo ""
print_status "To check application logs: pm2 logs br-driver-app"
print_status "To restart if needed: pm2 restart br-driver-app"
