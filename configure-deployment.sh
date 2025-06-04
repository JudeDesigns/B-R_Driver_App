#!/bin/bash

# Configuration script for deployment setup
# Run this once to set up your deployment workflow

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

echo "🔧 B&R Driver App Deployment Configuration"
echo "=========================================="
echo ""

print_status "This will configure your deployment workflow."
echo ""

# Get git repository URL
if git remote get-url origin > /dev/null 2>&1; then
    DEFAULT_REPO=$(git remote get-url origin)
    read -p "Git repository URL [$DEFAULT_REPO]: " REPO_URL
    REPO_URL=${REPO_URL:-$DEFAULT_REPO}
else
    read -p "Git repository URL: " REPO_URL
fi

if [ -z "$REPO_URL" ]; then
    print_error "Git repository URL is required!"
    exit 1
fi

# Get server details
read -p "VPS username: " SERVER_USER
read -p "VPS IP address: " SERVER_IP
read -p "App directory on server: " SERVER_APP_DIR
read -p "PM2 app name [br-driver-app]: " APP_NAME
APP_NAME=${APP_NAME:-br-driver-app}

echo ""
print_status "Configuration Summary:"
echo "  Git Repository: $REPO_URL"
echo "  VPS Username: $SERVER_USER"
echo "  VPS IP: $SERVER_IP"
echo "  Server App Directory: $SERVER_APP_DIR"
echo "  PM2 App Name: $APP_NAME"
echo ""

read -p "Is this correct? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Configuration cancelled."
    exit 1
fi

# Configure the server update script
print_status "Configuring server update script..."
cp update-server.sh update-server.sh.backup
sed -i.tmp "s|REPO_URL=\"YOUR_GIT_REPO_URL\"|REPO_URL=\"$REPO_URL\"|g" update-server.sh
sed -i.tmp "s|APP_DIR=\"/path/to/your/app\"|APP_DIR=\"$SERVER_APP_DIR\"|g" update-server.sh
sed -i.tmp "s|APP_NAME=\"br-driver-app\"|APP_NAME=\"$APP_NAME\"|g" update-server.sh
rm -f update-server.sh.tmp

# Configure the local deployment script
print_status "Configuring local deployment script..."
cp deploy-to-server.sh deploy-to-server.sh.backup
sed -i.tmp "s|SERVER_USER=\"your_username\"|SERVER_USER=\"$SERVER_USER\"|g" deploy-to-server.sh
sed -i.tmp "s|SERVER_IP=\"your_server_ip\"|SERVER_IP=\"$SERVER_IP\"|g" deploy-to-server.sh
sed -i.tmp "s|SERVER_APP_DIR=\"/path/to/your/app\"|SERVER_APP_DIR=\"$SERVER_APP_DIR\"|g" deploy-to-server.sh
rm -f deploy-to-server.sh.tmp

# Make scripts executable
chmod +x update-server.sh
chmod +x deploy-to-server.sh

print_success "✅ Configuration completed!"
echo ""
print_status "Your deployment workflow is now ready!"
echo ""
print_status "To deploy your application:"
echo "  1. Make your code changes locally"
echo "  2. Test with: npm run dev"
echo "  3. Deploy with: ./deploy-to-server.sh"
echo ""
print_status "The deployment process will:"
echo "  ✅ Commit and push your changes to git"
echo "  ✅ Copy the update script to your server (first time)"
echo "  ✅ Trigger zero-downtime update on your server"
echo "  ✅ Preserve your database, uploads, and environment files"
echo "  ✅ Automatically rollback if anything fails"
echo ""
print_warning "Next steps:"
echo "  1. Make sure your git repository is accessible from your VPS"
echo "  2. Ensure SSH key authentication is set up for your VPS"
echo "  3. Test the deployment: ./deploy-to-server.sh"
echo ""
print_status "For manual server updates, copy update-server.sh to your VPS and run it directly."
