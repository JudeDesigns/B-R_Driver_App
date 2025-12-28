#!/bin/bash

# Create Missing Tables for System Documents
# This script ONLY creates tables that don't exist - 100% SAFE

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Database credentials
DB_USER="br_user"
DB_NAME="br_food_services"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Create Missing Tables${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will:${NC}"
echo "1. Create document_acknowledgments table (if missing)"
echo "2. Create safety_declarations table (if missing)"
echo ""
echo -e "${GREEN}✓ 100% SAFE - Only creates tables that don't exist${NC}"
echo -e "${GREEN}✓ Does NOT modify existing tables${NC}"
echo -e "${GREEN}✓ Does NOT delete any data${NC}"
echo ""

read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${YELLOW}Creating missing tables...${NC}"

# Run the SQL script
psql -U $DB_USER -d $DB_NAME -f create-missing-tables.sql

echo ""
echo -e "${YELLOW}Regenerating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Done!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Restart the application: pm2 restart br-driver-app"
echo "2. Test System Documents page"
echo "3. Check logs: pm2 logs br-driver-app --lines 20"
echo ""

