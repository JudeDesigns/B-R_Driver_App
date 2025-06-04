#!/bin/bash

# Setup script for the zero-downtime update script
# Run this once to configure the update script with your settings

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

echo "🔧 B&R Driver App Update Script Configuration"
echo "============================================="
echo ""

print_status "This script will configure your zero-downtime update script."
echo ""

# Get current directory as default
CURRENT_DIR=$(pwd)

# Get configuration from user
echo "Please provide the following information:"
echo ""

read -p "Git repository URL: " REPO_URL
if [ -z "$REPO_URL" ]; then
    print_error "Git repository URL is required!"
    exit 1
fi

read -p "Current app directory path [$CURRENT_DIR]: " APP_DIR
APP_DIR=${APP_DIR:-$CURRENT_DIR}

read -p "PM2 app name [br-driver-app]: " APP_NAME
APP_NAME=${APP_NAME:-br-driver-app}

echo ""
print_status "Configuration:"
echo "  Git Repository: $REPO_URL"
echo "  App Directory: $APP_DIR"
echo "  PM2 App Name: $APP_NAME"
echo ""

read -p "Is this correct? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Configuration cancelled."
    exit 1
fi

# Update the update-server.sh script
print_status "Updating update-server.sh script..."

# Create a backup of the original script
cp update-server.sh update-server.sh.backup

# Update the configuration variables
sed -i.tmp "s|REPO_URL=\"YOUR_GIT_REPO_URL\"|REPO_URL=\"$REPO_URL\"|g" update-server.sh
sed -i.tmp "s|APP_DIR=\"/path/to/your/app\"|APP_DIR=\"$APP_DIR\"|g" update-server.sh
sed -i.tmp "s|APP_NAME=\"br-driver-app\"|APP_NAME=\"$APP_NAME\"|g" update-server.sh

# Remove temporary file
rm -f update-server.sh.tmp

# Make the script executable
chmod +x update-server.sh

print_success "✅ Configuration completed!"
echo ""
print_status "Your update script is now ready to use."
echo ""
print_status "To update your application:"
echo "  1. Copy update-server.sh to your VPS"
echo "  2. Run: ./update-server.sh"
echo ""
print_status "The script will:"
echo "  ✅ Clone fresh code from git"
echo "  ✅ Install dependencies and build"
echo "  ✅ Run database migrations"
echo "  ✅ Preserve your uploads and environment files"
echo "  ✅ Perform zero-downtime reload with PM2"
echo "  ✅ Run health checks"
echo "  ✅ Rollback automatically if something fails"
echo ""
print_warning "Important notes:"
echo "  - Make sure your git repository is accessible from your VPS"
echo "  - Ensure your PM2 app name matches what you're currently using"
echo "  - The script preserves uploads and environment files automatically"
echo "  - A backup is created before each update"
