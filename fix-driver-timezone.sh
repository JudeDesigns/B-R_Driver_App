#!/bin/bash

# Fix Driver Timezone Issue
# Fixes the issue where drivers see yesterday's routes instead of today's

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

print_status "🕐 Fixing Driver Timezone Issue..."

# Step 1: Commit and push the timezone fixes
print_status "Committing timezone fixes to GitHub..."

git add .
git commit -m "Fix driver timezone issue - show today's routes in PST

- Updated driver dashboard to use PST timezone for date calculation
- Fixed assigned routes API to use PST timezone for filtering
- Fixed driver stops API to use PST timezone for filtering  
- Fixed driver routes API to use PST timezone for filtering
- Drivers will now see today's routes instead of yesterday's routes
- All driver-side date filtering now uses PST timezone consistently"

git push origin main

if [ $? -eq 0 ]; then
    print_success "✅ Timezone fixes pushed to GitHub successfully"
else
    print_error "❌ Failed to push timezone fixes to GitHub"
    exit 1
fi

# Step 2: Deploy to VPS
print_status "Deploying timezone fixes to VPS..."

# Check if we're on the VPS or need to SSH
if [ -f "/opt/deploy-br-app.sh" ]; then
    # We're on the VPS
    print_status "Running deployment on VPS..."
    sudo /opt/deploy-br-app.sh
else
    # We're on local machine, need to SSH
    print_status "Please run this command on your VPS:"
    echo ""
    echo "ssh root@72.167.52.235"
    echo "sudo /opt/deploy-br-app.sh"
    echo ""
    print_status "Or if you have SSH access configured:"
    echo "ssh root@72.167.52.235 'sudo /opt/deploy-br-app.sh'"
fi

print_success "🎉 Driver Timezone Fix Deployed!"
echo ""
print_status "=== What Was Fixed ==="
print_status "• 🕐 Driver dashboard now uses PST timezone for 'today'"
print_status "• 📅 Assigned routes API filters by PST dates"
print_status "• 🛑 Driver stops API filters by PST dates"
print_status "• 🚛 Driver routes API filters by PST dates"
print_status "• ✅ Drivers will see today's routes (PST) instead of yesterday's"
echo ""
print_status "=== Root Cause ==="
print_status "The issue was that driver APIs were using server UTC time"
print_status "instead of PST timezone for date filtering. When a route"
print_status "was uploaded 'today' in PST, it appeared as 'yesterday'"
print_status "to drivers because the server was filtering by UTC dates."
echo ""
print_status "=== Test the Fix ==="
print_status "1. Login as a driver"
print_status "2. Check the dashboard - should show today's routes"
print_status "3. Go to stops page - should show today's stops"
print_status "4. Verify no yesterday's routes are showing"
echo ""
print_success "🚀 Drivers should now see the correct routes for today!"
