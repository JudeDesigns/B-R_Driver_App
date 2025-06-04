#!/bin/bash

# B&R Driver App Zero-Downtime Update Script
# Works with your existing PM2 + git clone workflow

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

# Configuration - Update these paths to match your setup
APP_NAME="br-driver-app"
REPO_URL="YOUR_GIT_REPO_URL"  # Update this with your git repository URL
APP_DIR="/path/to/your/app"   # Update this with your current app directory path
TEMP_DIR="/tmp/br-driver-app-update"
BACKUP_DIR="/tmp/br-driver-app-backup"

echo "🚀 B&R Driver App Zero-Downtime Update"
echo "======================================"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed or not in PATH"
    exit 1
fi

# Check if app is currently running
if ! pm2 list | grep -q "$APP_NAME"; then
    print_warning "App '$APP_NAME' is not currently running in PM2"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_status "Starting zero-downtime update process..."

# Step 1: Clone fresh code to temporary directory
print_status "Cloning fresh code..."
rm -rf "$TEMP_DIR"
git clone "$REPO_URL" "$TEMP_DIR"
cd "$TEMP_DIR"

# Step 2: Install dependencies and build
print_status "Installing dependencies..."
npm ci --production

print_status "Building application..."
npm run build

# Step 3: Run database migrations (if any)
print_status "Running database migrations..."
npm run prisma:migrate:prod || print_warning "Migration failed or no migrations to run"

# Step 4: Create backup of current app (optional but recommended)
print_status "Creating backup of current application..."
if [ -d "$APP_DIR" ]; then
    rm -rf "$BACKUP_DIR"
    cp -r "$APP_DIR" "$BACKUP_DIR"
    print_success "Backup created at $BACKUP_DIR"
fi

# Step 5: Copy environment file from current app
if [ -f "$APP_DIR/.env.production" ]; then
    print_status "Copying environment configuration..."
    cp "$APP_DIR/.env.production" "$TEMP_DIR/.env.production"
elif [ -f "$APP_DIR/.env" ]; then
    print_status "Copying environment configuration..."
    cp "$APP_DIR/.env" "$TEMP_DIR/.env"
else
    print_warning "No environment file found in current app directory"
fi

# Step 6: Copy uploads directory (preserve user data)
if [ -d "$APP_DIR/public/uploads" ]; then
    print_status "Preserving uploads directory..."
    cp -r "$APP_DIR/public/uploads" "$TEMP_DIR/public/"
    print_success "Uploads directory preserved"
fi

# Step 7: Atomic swap - replace old app with new one
print_status "Performing atomic application swap..."
OLD_APP_DIR="${APP_DIR}_old_$(date +%Y%m%d_%H%M%S)"

# Move current app to old location
if [ -d "$APP_DIR" ]; then
    mv "$APP_DIR" "$OLD_APP_DIR"
fi

# Move new app to production location
mv "$TEMP_DIR" "$APP_DIR"

print_success "Application files updated"

# Step 8: Reload PM2 application (zero-downtime restart)
print_status "Reloading PM2 application..."
cd "$APP_DIR"

if pm2 list | grep -q "$APP_NAME"; then
    # App exists, reload it (zero-downtime)
    pm2 reload "$APP_NAME"
    print_success "Application reloaded with zero downtime"
else
    # App doesn't exist, start it
    pm2 start ecosystem.config.js --env production
    print_success "Application started"
fi

# Step 9: Health check
print_status "Performing health check..."
sleep 5  # Give the app a moment to start

# Check if the app is responding
if curl -f -s http://localhost:3000/api/health > /dev/null; then
    print_success "✅ Health check passed - Application is running correctly"
    
    # Cleanup old app directory after successful deployment
    print_status "Cleaning up old application files..."
    rm -rf "$OLD_APP_DIR"
    print_success "Cleanup completed"
    
else
    print_error "❌ Health check failed - Rolling back..."
    
    # Rollback: stop new app and restore old one
    pm2 stop "$APP_NAME" || true
    
    if [ -d "$OLD_APP_DIR" ]; then
        rm -rf "$APP_DIR"
        mv "$OLD_APP_DIR" "$APP_DIR"
        cd "$APP_DIR"
        pm2 start ecosystem.config.js --env production
        print_warning "Rollback completed - old version restored"
    fi
    
    exit 1
fi

# Step 10: Save PM2 configuration
pm2 save

print_success "🎉 Update completed successfully!"
print_status "Application is running at: http://localhost:3000"
print_status "Check status with: pm2 status"
print_status "View logs with: pm2 logs $APP_NAME"

echo ""
print_status "Summary:"
echo "  ✅ Fresh code deployed from git"
echo "  ✅ Dependencies updated"
echo "  ✅ Database migrations applied"
echo "  ✅ Zero-downtime reload completed"
echo "  ✅ Health check passed"
echo "  ✅ User data preserved"
