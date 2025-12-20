#!/bin/bash

# Fix Next.js Chunk Loading Error
# Run this on your AlmaLinux server as root

set -e

echo "=========================================="
echo "Next.js Chunk Error Fix Script"
echo "=========================================="
echo ""

# Get app directory
APP_DIR="/root/B-R_Driver_App"
cd "$APP_DIR" || exit 1

echo "Working directory: $(pwd)"
echo ""

# Step 1: Stop application
echo "Step 1: Stopping application..."
pm2 stop all || true
pm2 delete all || true
echo "✓ Application stopped"
echo ""

# Step 2: Clean everything
echo "Step 2: Cleaning build artifacts..."
rm -rf .next
rm -rf node_modules/.cache
echo "✓ Build artifacts cleaned"
echo ""

# Step 3: Verify dependencies
echo "Step 3: Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
else
    echo "Dependencies already installed"
fi
echo "✓ Dependencies verified"
echo ""

# Step 4: Generate Prisma Client
echo "Step 4: Generating Prisma Client..."
npx prisma generate
echo "✓ Prisma Client generated"
echo ""

# Step 5: Build in production mode
echo "Step 5: Building application in PRODUCTION mode..."
export NODE_ENV=production
npm run build

# Check if build succeeded
if [ ! -d ".next/static/chunks" ]; then
    echo "❌ ERROR: Build failed - .next/static/chunks not found!"
    exit 1
fi

echo "✓ Build completed successfully"
echo ""

# Step 6: Verify chunks exist
echo "Step 6: Verifying chunk files..."
CHUNK_COUNT=$(ls -1 .next/static/chunks/*.js 2>/dev/null | wc -l)
echo "Found $CHUNK_COUNT chunk files"

if [ "$CHUNK_COUNT" -eq 0 ]; then
    echo "❌ ERROR: No chunk files found!"
    exit 1
fi

echo "✓ Chunk files verified"
echo ""

# Step 7: Fix permissions
echo "Step 7: Fixing permissions..."
chown -R root:root .next/
chmod -R 755 .next/
echo "✓ Permissions fixed"
echo ""

# Step 8: Start application with explicit NODE_ENV
echo "Step 8: Starting application in PRODUCTION mode..."
NODE_ENV=production pm2 start ecosystem.config.js --env production --name br-driver-app

# Wait for app to start
sleep 3

# Step 9: Save PM2 configuration
echo "Step 9: Saving PM2 configuration..."
pm2 save
echo "✓ PM2 configuration saved"
echo ""

# Step 10: Verify application is running
echo "Step 10: Verifying application status..."
pm2 status

echo ""
echo "=========================================="
echo "Verification Steps"
echo "=========================================="
echo ""

# Check NODE_ENV
echo "Checking NODE_ENV..."
pm2 describe br-driver-app | grep -A 5 "env:" | grep NODE_ENV || echo "⚠ NODE_ENV not found in PM2 config"

echo ""
echo "Checking for chunk errors in logs..."
sleep 2
pm2 logs br-driver-app --lines 20 --nostream | grep -i "chunk\|TypeError.*reading.*a" && echo "⚠ Still seeing chunk errors!" || echo "✓ No chunk errors found"

echo ""
echo "=========================================="
echo "Fix Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open your browser and clear cache (Ctrl+Shift+Delete)"
echo "2. Navigate to your app"
echo "3. Try uploading a product"
echo "4. Monitor logs with: pm2 logs br-driver-app"
echo ""
echo "If you still see errors, run:"
echo "  pm2 logs br-driver-app --lines 100"
echo ""

