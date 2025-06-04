#!/bin/bash

# Local deployment helper script
# Pushes your changes to git and triggers server update

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

# Configuration - Update these with your server details
SERVER_USER="your_username"     # Update with your VPS username
SERVER_IP="your_server_ip"      # Update with your VPS IP
SERVER_APP_DIR="/path/to/your/app"  # Update with your app directory on server

echo "🚀 B&R Driver App Deployment Helper"
echo "==================================="
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "This is not a git repository!"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes."
    echo ""
    git status --short
    echo ""
    read -p "Do you want to commit these changes? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message: " COMMIT_MSG
        if [ -z "$COMMIT_MSG" ]; then
            COMMIT_MSG="Update application - $(date)"
        fi
        
        print_status "Committing changes..."
        git add .
        git commit -m "$COMMIT_MSG"
        print_success "Changes committed"
    else
        print_warning "Proceeding with uncommitted changes..."
    fi
fi

# Push to git repository
print_status "Pushing to git repository..."
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH"
print_success "Code pushed to git repository"

# Copy update script to server (if it doesn't exist)
print_status "Checking if update script exists on server..."
if ! ssh "$SERVER_USER@$SERVER_IP" "test -f $SERVER_APP_DIR/update-server.sh"; then
    print_status "Copying update script to server..."
    scp update-server.sh "$SERVER_USER@$SERVER_IP:$SERVER_APP_DIR/"
    ssh "$SERVER_USER@$SERVER_IP" "chmod +x $SERVER_APP_DIR/update-server.sh"
    print_success "Update script copied to server"
fi

# Run the update on the server
print_status "Triggering zero-downtime update on server..."
echo ""
ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_APP_DIR && ./update-server.sh"

print_success "🎉 Deployment completed!"
echo ""
print_status "Your application has been updated with zero downtime."
print_status "Check your application at: http://$SERVER_IP"
