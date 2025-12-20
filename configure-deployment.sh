#!/bin/bash

# B&R Driver App - Server Configuration Script
# Usage: ./configure-deployment.sh
# Run this once on your server to set up dependencies

set -e

echo "🛠️ Starting server configuration..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

# Install PM2 globally if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
else
    echo "✅ PM2 is already installed."
fi

# Setup PM2 startup hook
echo "🔄 Setting up PM2 startup hook..."
pm2 startup || echo "⚠️  Please run the command displayed above manually if this failed."

# Create logs directory
echo "📂 Creating logs directory..."
mkdir -p logs

# Make deploy script executable
chmod +x deploy-to-server.sh

echo "✅ Configuration completed!"
echo "👉 You can now run ./deploy-to-server.sh to deploy the app."
