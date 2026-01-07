#!/bin/bash

# Production Deployment Script - Fix Document Acknowledgments
# This script fixes the missing routeId and userAgent columns

set -e  # Exit on any error

echo "=========================================="
echo "Production Fix: Document Acknowledgments"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Backup database (IMPORTANT!)
echo -e "${YELLOW}Step 1: Backup Database${NC}"
echo "Before running this script on production, make sure you have a recent backup!"
echo ""
read -p "Have you backed up the production database? (yes/no): " backup_confirm

if [ "$backup_confirm" != "yes" ]; then
    echo -e "${RED}Aborting. Please backup the database first.${NC}"
    exit 1
fi

# Step 2: Pull latest code
echo ""
echo -e "${YELLOW}Step 2: Pull Latest Code${NC}"
git pull origin main
echo -e "${GREEN}✓ Code updated${NC}"

# Step 3: Install dependencies
echo ""
echo -e "${YELLOW}Step 3: Install Dependencies${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 4: Run SQL migration
echo ""
echo -e "${YELLOW}Step 4: Apply Database Migration${NC}"
echo "This will add routeId and userAgent columns to document_acknowledgments table"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    echo "Please set it in your .env file or export it"
    exit 1
fi

# Run the SQL migration using Prisma's db execute
npx prisma db execute --file ./fix-document-acknowledgments-production.sql --schema ./prisma/schema.prisma

echo -e "${GREEN}✓ Database migration applied${NC}"

# Step 5: Generate Prisma Client
echo ""
echo -e "${YELLOW}Step 5: Generate Prisma Client${NC}"
npx prisma generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

# Step 6: Build application
echo ""
echo -e "${YELLOW}Step 6: Build Application${NC}"
npm run build
echo -e "${GREEN}✓ Application built${NC}"

# Step 7: Restart PM2
echo ""
echo -e "${YELLOW}Step 7: Restart Application${NC}"
pm2 restart br-driver-app
echo -e "${GREEN}✓ Application restarted${NC}"

# Step 8: Verify
echo ""
echo -e "${YELLOW}Step 8: Verify Deployment${NC}"
pm2 logs br-driver-app --lines 50 --nostream

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Production Fix Deployed Successfully!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test document acknowledgment feature"
echo "2. Monitor logs for any errors"
echo "3. Check that driver locations are being tracked"

