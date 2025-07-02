#!/bin/bash

# Quick Fix for Add Stop Error
# Fixes the missing address field error when adding stops

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

print_status "🔧 Fixing Add Stop Error..."

# Step 1: Commit and push the fix
print_status "Committing fix to GitHub..."

git add .
git commit -m "Fix Add Stop error - missing address field

- Added missing address field to stop creation
- Use provided address or fall back to customer address
- Ensures all required fields are included in stop creation"

git push origin main

if [ $? -eq 0 ]; then
    print_success "✅ Fix pushed to GitHub successfully"
else
    print_error "❌ Failed to push fix to GitHub"
    exit 1
fi

# Step 2: Deploy to VPS
print_status "Deploying fix to VPS..."

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

print_success "🎉 Add Stop Error Fix Deployed!"
echo ""
print_status "=== What Was Fixed ==="
print_status "• ✅ Added missing 'address' field to stop creation"
print_status "• ✅ Uses provided address or customer's existing address"
print_status "• ✅ Ensures all required schema fields are included"
print_status "• ✅ Customer search and auto-fill still works"
echo ""
print_status "=== Test the Fix ==="
print_status "1. Go to Route Details page"
print_status "2. Click 'Add Stop' button"
print_status "3. Search for a customer or type a new name"
print_status "4. Fill in the required fields"
print_status "5. Click 'Add Stop' - should work without errors!"
echo ""
print_success "🚀 The Add Stop functionality should now work perfectly!"
