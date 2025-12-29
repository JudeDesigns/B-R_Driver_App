#!/bin/bash

# Complete Production Update Script
# Fixes document acknowledgment issue and updates application

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Production Update - Document Fix${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will:${NC}"
echo "1. Pull latest code from git"
echo "2. Fix database schema"
echo "3. Regenerate Prisma client"
echo "4. Rebuild application"
echo "5. Restart PM2 process"
echo ""

read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 0
fi

echo ""

# Step 1: Pull latest code
echo -e "${BLUE}Step 1: Pulling latest code...${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Step 2: Fix database
echo -e "${BLUE}Step 2: Fixing database schema...${NC}"
bash fix-document-acknowledgments.sh
echo -e "${GREEN}✓ Database fixed${NC}"
echo ""

# Step 3: Install dependencies (if needed)
echo -e "${BLUE}Step 3: Checking dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies checked${NC}"
echo ""

# Step 4: Build application
echo -e "${BLUE}Step 4: Building application...${NC}"
npm run build
echo -e "${GREEN}✓ Application built${NC}"
echo ""

# Step 5: Restart PM2
echo -e "${BLUE}Step 5: Restarting application...${NC}"
pm2 restart br-driver-app
echo -e "${GREEN}✓ Application restarted${NC}"
echo ""

# Step 6: Check status
echo -e "${BLUE}Step 6: Checking application status...${NC}"
pm2 status br-driver-app
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Update Complete!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Check logs: pm2 logs br-driver-app --lines 50"
echo "2. Test document acknowledgment from driver app"
echo "3. Monitor for any errors"
echo ""

echo -e "${GREEN}Document acknowledgment should now work!${NC}"
echo ""

