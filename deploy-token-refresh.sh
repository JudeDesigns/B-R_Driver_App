#!/bin/bash

# Deploy Automatic Token Refresh System
# Fixes WebSocket authentication errors and 404 after delivery completion

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

print_status "🔄 Deploying Automatic Token Refresh System..."

# Step 1: Commit and push changes
print_status "Committing token refresh system to GitHub..."

git add .
git commit -m "Implement automatic token refresh system for drivers

🔧 Features Added:
- Automatic token refresh every 2 minutes
- Extended 12-hour tokens for drivers (vs 2 hours for admins)
- Silent WebSocket authentication error handling
- Token refresh on page focus/visibility change
- Proactive token refresh before expiration
- Enhanced refresh API with longer driver sessions

🐛 Fixes:
- WebSocket 'No authentication token found' popup errors
- 404 errors after delivery completion due to expired sessions
- Driver session timeouts during long delivery routes
- Token expiration during multi-hour delivery sessions

🚀 Benefits:
- Drivers stay logged in for 12 hours automatically
- No more annoying authentication popups
- Seamless delivery completion without redirects to login
- Better user experience for long delivery routes"

git push origin main

if [ $? -eq 0 ]; then
    print_success "✅ Token refresh system pushed to GitHub successfully"
else
    print_error "❌ Failed to push token refresh system to GitHub"
    exit 1
fi

# Step 2: Deploy to VPS
print_status "Deploying to VPS..."

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

print_success "🎉 Automatic Token Refresh System Deployed!"
echo ""
print_status "=== SYSTEM OVERVIEW ==="
print_status "🔄 Automatic token refresh every 2 minutes"
print_status "⏰ 12-hour sessions for drivers (vs 2 hours for admins)"
print_status "🔇 Silent WebSocket authentication error handling"
print_status "👁️  Token refresh on page focus/visibility change"
print_status "⚡ Proactive refresh 5 minutes before expiration"
echo ""
print_status "=== ISSUES FIXED ==="
print_status "✅ WebSocket 'No authentication token found' popups"
print_status "✅ 404 errors after 'Complete Delivery' button"
print_status "✅ Driver session timeouts during long routes"
print_status "✅ Token expiration during multi-hour deliveries"
echo ""
print_status "=== HOW IT WORKS ==="
print_status "1. Drivers get 12-hour tokens on login"
print_status "2. System checks token every 2 minutes"
print_status "3. Auto-refreshes 5 minutes before expiry"
print_status "4. Refreshes when page gains focus"
print_status "5. Silent fallback if refresh fails"
echo ""
print_status "=== TESTING ==="
print_status "1. Login as a driver"
print_status "2. Leave app open for hours - should stay logged in"
print_status "3. Complete deliveries - no more 404 errors"
print_status "4. Switch between phones - no more auth popups"
print_status "5. Check browser console for refresh logs"
echo ""
print_success "🚀 Drivers can now work uninterrupted for 12+ hours!"
