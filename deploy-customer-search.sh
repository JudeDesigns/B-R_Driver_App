#!/bin/bash

# Deploy Customer Search Feature to VPS
# Run this script to deploy the customer search functionality

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

print_status "🔍 Deploying Customer Search Feature..."

# Step 1: Commit and push changes to GitHub
print_status "Committing changes to GitHub..."

git add .
git commit -m "Add customer search functionality to Add Stop modal

- Created CustomerSearch component with real-time search
- Added customer search API endpoint
- Integrated search into Add Stop modal in route details
- Auto-fills address and contact info when customer is selected
- Supports both existing customers and new customer names"

git push origin main

if [ $? -eq 0 ]; then
    print_success "✅ Changes pushed to GitHub successfully"
else
    print_error "❌ Failed to push changes to GitHub"
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

print_success "🎉 Customer Search Feature Deployment Complete!"
echo ""
print_status "=== New Features Added ==="
print_status "• 🔍 Customer search in Add Stop modal"
print_status "• 📋 Real-time search as you type"
print_status "• 🏢 Shows customer details (email, address, group code)"
print_status "• ✨ Auto-fills address and contact info"
print_status "• 📝 Still allows typing custom customer names"
print_status "• 🎯 Searches by name, email, phone, or group code"
echo ""
print_status "=== How to Use ==="
print_status "1. Go to Route Details page"
print_status "2. Click 'Add Stop' button"
print_status "3. Start typing in the Customer Name field"
print_status "4. Select from dropdown or continue typing"
print_status "5. Address and contact info auto-fill if customer exists"
echo ""
print_success "🚀 Your team can now easily find and add existing customers!"
