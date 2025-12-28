#!/bin/bash

# Fix system_documents Table
# This script will properly create or fix the system_documents table

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Database credentials
DB_USER="br_user"
DB_NAME="br_food_services"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Fix system_documents Table${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Step 1: Checking current state...${NC}"
echo ""

# Check if table exists and has correct structure
echo "Checking if system_documents table exists..."
TABLE_EXISTS=$(psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents');")

if [ "$TABLE_EXISTS" = "t" ]; then
    echo -e "${GREEN}✓ Table exists${NC}"
    
    # Check if it has the title column
    TITLE_EXISTS=$(psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_documents' AND column_name='title');")
    
    if [ "$TITLE_EXISTS" = "f" ]; then
        echo -e "${RED}✗ Table has wrong structure (missing 'title' column)${NC}"
        echo -e "${YELLOW}  Will drop and recreate the table${NC}"
        
        # Check if there's any data
        ROW_COUNT=$(psql -U $DB_USER -d $DB_NAME -tAc "SELECT COUNT(*) FROM system_documents;" 2>/dev/null || echo "0")
        
        if [ "$ROW_COUNT" != "0" ]; then
            echo -e "${RED}⚠️  WARNING: Table has $ROW_COUNT rows of data!${NC}"
            echo -e "${RED}⚠️  This data will be LOST when we recreate the table!${NC}"
            echo ""
            read -p "Do you want to continue? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                echo -e "${RED}Aborted.${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${GREEN}✓ Table structure looks correct${NC}"
        echo -e "${YELLOW}  Script will verify and skip if everything is OK${NC}"
    fi
else
    echo -e "${YELLOW}✗ Table doesn't exist - will create it${NC}"
fi

echo ""
echo -e "${YELLOW}Step 2: Running fix script...${NC}"
echo ""

# Run the SQL fix script
psql -U $DB_USER -d $DB_NAME -f fix-system-documents-table.sql

echo ""
echo -e "${YELLOW}Step 3: Verifying the fix...${NC}"
echo ""

# Verify the table structure
echo "Table structure:"
psql -U $DB_USER -d $DB_NAME -c "\d system_documents" | head -20

echo ""
echo -e "${YELLOW}Step 4: Regenerating Prisma client...${NC}"
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

