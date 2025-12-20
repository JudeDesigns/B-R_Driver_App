#!/bin/bash

# B&R Driver App - Deployment Script
# Usage: ./deploy-to-server.sh [version_tag_or_branch]
# Example: ./deploy-to-server.sh v1.0.0
# If no argument is provided, it pulls the latest 'main'.

set -e

TARGET_VERSION=$1

echo "🚀 Starting deployment process..."

# 1. Fetch latest changes
echo "📥 Fetching latest changes from git..."
git fetch --all --tags

# 2. Checkout version
if [ -z "$TARGET_VERSION" ]; then
    echo "👉 No version specified. Deploying latest 'main'..."
    git checkout main
    git pull origin main
else
    echo "👉 Deploying version: $TARGET_VERSION"
    git checkout "$TARGET_VERSION"
fi

# 3. Clean old build artifacts
echo "🧹 Cleaning old build artifacts..."
rm -rf .next

# 4. Install dependencies
echo "📦 Installing dependencies..."
npm ci

# 5. Build application
echo "🏗️ Building application..."
npm run build

# 6. Run database migrations
echo "🗄️ Running database migrations..."
npm run db:setup:prod

# 7. Restart application with PM2
echo "🔄 Restarting application..."
# We use 'pm2 reload' for zero-downtime reloads if the app is running,
# otherwise 'pm2 start' to launch it.
if pm2 show br-driver-app > /dev/null; then
    pm2 reload ecosystem.config.js --env production
else
    pm2 start ecosystem.config.js --env production
fi

echo "✅ Deployment of ${TARGET_VERSION:-latest} completed successfully!"
