#!/bin/bash

# Comprehensive Server Diagnostic Script
# Run this on your AlmaLinux server to diagnose the chunk error

echo "=========================================="
echo "Server Diagnostic Report"
echo "=========================================="
echo ""

APP_DIR="/root/B-R_Driver_App"
cd "$APP_DIR" || exit 1

echo "1. ENVIRONMENT CHECK"
echo "----------------------------------------"
echo "Working Directory: $(pwd)"
echo "Node Version: $(node -v)"
echo "NPM Version: $(npm -v)"
echo "User: $(whoami)"
echo ""

echo "2. PM2 STATUS"
echo "----------------------------------------"
pm2 status
echo ""

echo "3. PM2 ENVIRONMENT VARIABLES"
echo "----------------------------------------"
pm2 describe br-driver-app | grep -A 20 "env:" || echo "App not running"
echo ""

echo "4. BUILD ARTIFACTS CHECK"
echo "----------------------------------------"
if [ -d ".next" ]; then
    echo "✓ .next folder exists"
    echo "  Size: $(du -sh .next | cut -f1)"
    
    if [ -d ".next/static/chunks" ]; then
        CHUNK_COUNT=$(ls -1 .next/static/chunks/*.js 2>/dev/null | wc -l)
        echo "✓ .next/static/chunks exists"
        echo "  Chunk files: $CHUNK_COUNT"
        echo "  Sample chunks:"
        ls -lh .next/static/chunks/*.js 2>/dev/null | head -5
    else
        echo "❌ .next/static/chunks NOT FOUND!"
    fi
    
    if [ -d ".next/server" ]; then
        echo "✓ .next/server exists"
    else
        echo "❌ .next/server NOT FOUND!"
    fi
else
    echo "❌ .next folder NOT FOUND!"
fi
echo ""

echo "5. DEPENDENCIES CHECK"
echo "----------------------------------------"
echo "xlsx package:"
npm list xlsx 2>&1 | grep xlsx || echo "❌ xlsx not found"

echo ""
echo "@prisma/client package:"
npm list @prisma/client 2>&1 | grep @prisma/client || echo "❌ @prisma/client not found"

echo ""
echo "Prisma Client generated:"
if [ -d "node_modules/.prisma/client" ]; then
    echo "✓ Prisma Client exists"
    ls -lh node_modules/.prisma/client/*.node 2>/dev/null | head -3
else
    echo "❌ Prisma Client NOT generated!"
fi
echo ""

echo "6. ENVIRONMENT FILE CHECK"
echo "----------------------------------------"
if [ -f ".env" ]; then
    echo "✓ .env file exists"
    echo "  Size: $(stat -f%z .env 2>/dev/null || stat -c%s .env)"
    echo "  Contains DATABASE_URL: $(grep -q DATABASE_URL .env && echo 'Yes' || echo 'No')"
    echo "  Contains JWT_SECRET: $(grep -q JWT_SECRET .env && echo 'Yes' || echo 'No')"
    echo "  Contains NODE_ENV: $(grep -q NODE_ENV .env && echo 'Yes' || echo 'No')"
else
    echo "❌ .env file NOT FOUND!"
fi
echo ""

echo "7. RECENT ERROR LOGS"
echo "----------------------------------------"
echo "Last 30 lines of error logs:"
pm2 logs br-driver-app --lines 30 --err --nostream 2>/dev/null || echo "No error logs or app not running"
echo ""

echo "8. RECENT OUTPUT LOGS"
echo "----------------------------------------"
echo "Last 30 lines of output logs:"
pm2 logs br-driver-app --lines 30 --out --nostream 2>/dev/null || echo "No output logs or app not running"
echo ""

echo "9. PORT CHECK"
echo "----------------------------------------"
echo "Checking if port 3000 is in use:"
lsof -i :3000 2>/dev/null || netstat -tulpn 2>/dev/null | grep 3000 || echo "Port 3000 not in use"
echo ""

echo "10. NGINX CHECK"
echo "----------------------------------------"
if command -v nginx &> /dev/null; then
    echo "Nginx version: $(nginx -v 2>&1)"
    echo "Nginx status: $(systemctl is-active nginx 2>/dev/null || echo 'Unknown')"
    echo ""
    echo "Nginx configuration for app:"
    grep -r "proxy_pass.*3000" /etc/nginx/ 2>/dev/null | head -5 || echo "No nginx config found for port 3000"
else
    echo "Nginx not installed"
fi
echo ""

echo "11. MEMORY USAGE"
echo "----------------------------------------"
free -h
echo ""

echo "12. DISK SPACE"
echo "----------------------------------------"
df -h | grep -E "Filesystem|/$|/root"
echo ""

echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "CRITICAL CHECKS:"
echo "----------------------------------------"

# Critical check 1: .next/static/chunks
if [ ! -d ".next/static/chunks" ] || [ $(ls -1 .next/static/chunks/*.js 2>/dev/null | wc -l) -eq 0 ]; then
    echo "❌ CRITICAL: No chunk files found - BUILD REQUIRED!"
else
    echo "✓ Chunk files exist"
fi

# Critical check 2: NODE_ENV
if pm2 describe br-driver-app 2>/dev/null | grep -q "NODE_ENV.*production"; then
    echo "✓ Running in production mode"
else
    echo "⚠ WARNING: Not running in production mode!"
fi

# Critical check 3: Dependencies
if [ ! -d "node_modules/xlsx" ]; then
    echo "❌ CRITICAL: xlsx package missing!"
else
    echo "✓ xlsx package installed"
fi

# Critical check 4: Prisma
if [ ! -d "node_modules/.prisma/client" ]; then
    echo "❌ CRITICAL: Prisma Client not generated!"
else
    echo "✓ Prisma Client generated"
fi

echo ""
echo "Save this output and share it for analysis."
echo ""

