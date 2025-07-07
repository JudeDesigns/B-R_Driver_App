#!/bin/bash

# B&R Driver App - Smart Deployment Script
# Safely updates the application from GitHub with health checks and rollback

set -e  # Exit on any error

# Configuration
REPO_URL="https://github.com/JudeDesigns/B-R_Driver_App.git"
APP_NAME="br-driver-app"
APP_DIR="/opt/B-R_Driver_App"
BACKUP_DIR="/opt/backups"
HEALTH_CHECK_URL="http://localhost:3000"
MAX_HEALTH_RETRIES=15
HEALTH_RETRY_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Function to check if PM2 app is running
check_pm2_status() {
    if pm2 list | grep -q "$APP_NAME.*online"; then
        return 0
    else
        return 1
    fi
}

# Function to check application health
check_health() {
    local retries=0
    while [ $retries -lt $MAX_HEALTH_RETRIES ]; do
        # Try multiple health check endpoints
        if curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1 || \
           curl -f -s "$HEALTH_CHECK_URL/api/health" > /dev/null 2>&1 || \
           curl -f -s "$HEALTH_CHECK_URL/login" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        print_status "Health check attempt $retries/$MAX_HEALTH_RETRIES failed, retrying in ${HEALTH_RETRY_DELAY}s..."
        sleep $HEALTH_RETRY_DELAY
    done
    return 1
}

# Function to create backup
create_backup() {
    print_status "Creating backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Create timestamped backup
    local backup_name="br-driver-app-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    # Copy current application (excluding node_modules and .git)
    if [ -d "$APP_DIR" ]; then
        rsync -av --exclude='node_modules' --exclude='.git' --exclude='logs' --exclude='.next' "$APP_DIR/" "$backup_path/"
        print_success "Backup created at: $backup_path"
        echo "$backup_path" > /tmp/last_backup_path
    else
        print_warning "No existing application to backup"
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_path=$(cat /tmp/last_backup_path 2>/dev/null)
    if [ -n "$backup_path" ] && [ -d "$backup_path" ]; then
        print_warning "Restoring from backup: $backup_path"
        rsync -av --exclude='node_modules' --exclude='.git' --exclude='.next' "$backup_path/" "$APP_DIR/"
        return 0
    else
        print_error "No backup found to restore from"
        return 1
    fi
}

# Function to setup application directory
setup_app_directory() {
    if [ ! -d "$APP_DIR" ]; then
        print_status "Application directory doesn't exist. Cloning repository..."
        mkdir -p "$(dirname "$APP_DIR")"
        git clone "$REPO_URL" "$APP_DIR"
        cd "$APP_DIR"
    else
        print_status "Application directory exists. Updating from git..."
        cd "$APP_DIR"
        
        # Check if it's a git repository
        if [ ! -d ".git" ]; then
            print_error "Directory exists but is not a git repository!"
            exit 1
        fi
        
        # Stash any local changes
        git stash push -m "Auto-stash before deployment $(date)" || true
        
        # Fetch and pull latest changes
        git fetch origin
        git reset --hard origin/main
        git pull origin main
    fi
}

# Function to install dependencies and build
build_application() {
    print_status "Installing dependencies..."
    
    # Install dependencies
    npm ci
    
    print_status "Generating Prisma client..."
    npm run prisma:generate
    
    print_status "Building application..."
    npm run build
    
    print_success "Build completed successfully"
}

# Function to manage PM2 application
manage_pm2() {
    local action="$1"
    
    case "$action" in
        "start")
            if check_pm2_status; then
                print_status "Application already running, reloading..."
                pm2 reload "$APP_NAME"
            else
                print_status "Starting application..."
                pm2 start ecosystem.config.js --env production
            fi
            ;;
        "restart")
            print_status "Restarting application..."
            pm2 restart "$APP_NAME"
            ;;
        "reload")
            print_status "Reloading application (zero-downtime)..."
            pm2 reload "$APP_NAME"
            ;;
    esac
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    rm -f /tmp/last_backup_path
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Main deployment function
main() {
    print_status "🚀 Starting B&R Driver App deployment from GitHub..."
    print_status "Repository: $REPO_URL"
    print_status "Target directory: $APP_DIR"
    
    # Step 1: Check initial PM2 status
    if check_pm2_status; then
        print_success "PM2 app is currently running"
        INITIAL_STATUS="running"
        
        # Check initial health
        if check_health; then
            print_success "Application is healthy before update"
        else
            print_warning "Application health check failed before update"
        fi
    else
        print_warning "PM2 app is not running"
        INITIAL_STATUS="stopped"
    fi
    
    # Step 2: Create backup
    create_backup
    
    # Step 3: Setup/update application directory
    setup_app_directory
    
    # Step 4: Build application
    build_application
    
    # Step 5: Manage PM2 application
    if [ "$INITIAL_STATUS" = "running" ]; then
        manage_pm2 "reload"
    else
        manage_pm2 "start"
    fi
    
    # Step 6: Wait for application to start
    print_status "Waiting for application to start..."
    sleep 8
    
    # Step 7: Health check after deployment
    print_status "Performing post-deployment health check..."
    
    if check_health; then
        print_success "✅ Deployment successful! Application is healthy."
        
        # Show PM2 status
        print_status "Current PM2 status:"
        pm2 list | grep "$APP_NAME" || pm2 list
        
        # Show application info
        print_status "Application accessible at: $HEALTH_CHECK_URL"
        
    else
        print_error "❌ Health check failed after deployment!"
        
        if [ "$INITIAL_STATUS" = "running" ]; then
            print_warning "Attempting to restore from backup..."
            
            if restore_backup; then
                print_status "Rebuilding restored application..."
                build_application
                
                print_status "Restarting application with backup..."
                manage_pm2 "restart"
                
                sleep 8
                
                if check_health; then
                    print_success "✅ Successfully restored from backup"
                else
                    print_error "❌ Backup restoration failed. Check logs: pm2 logs $APP_NAME"
                    exit 1
                fi
            else
                print_error "❌ Could not restore backup. Check logs: pm2 logs $APP_NAME"
                exit 1
            fi
        else
            print_error "❌ New deployment failed. Check logs: pm2 logs $APP_NAME"
            exit 1
        fi
    fi
    
    # Step 8: Clean up old backups (keep last 5)
    if [ -d "$BACKUP_DIR" ]; then
        print_status "Cleaning up old backups..."
        cd "$BACKUP_DIR"
        ls -t | tail -n +6 | xargs -r rm -rf 2>/dev/null || true
    fi
    
    print_success "🎉 Deployment completed successfully!"
    print_success "📱 Your B&R Driver App is now running the latest version!"
    
    # Show final status
    echo ""
    print_status "=== Final Status ==="
    pm2 list | grep "$APP_NAME" || echo "PM2 app not found in list"
    echo ""
    print_status "To view logs: pm2 logs $APP_NAME"
    print_status "To restart: pm2 restart $APP_NAME"
    print_status "To stop: pm2 stop $APP_NAME"
}

# Check if required commands exist
for cmd in git npm pm2 curl rsync; do
    if ! command -v $cmd &> /dev/null; then
        print_error "Required command '$cmd' not found. Please install it first."
        exit 1
    fi
done

# Check if script is run as root or with sudo
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Make sure file permissions are correct."
fi

# Run main function
main "$@"
