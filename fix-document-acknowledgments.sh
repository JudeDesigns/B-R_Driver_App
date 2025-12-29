#!/bin/bash

# Fix document_acknowledgments table - ensure createdAt and updatedAt have defaults

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Database credentials
DB_USER="br_user"
DB_NAME="br_food_services"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Fix document_acknowledgments Table${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Checking and fixing document_acknowledgments table...${NC}"
echo ""

# Fix the table structure
psql -U $DB_USER -d $DB_NAME << 'EOF'

-- Check if createdAt column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_acknowledgments' 
        AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE document_acknowledgments 
        ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added createdAt column';
    ELSE
        -- Ensure it has a default
        ALTER TABLE document_acknowledgments 
        ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'createdAt column already exists, ensured default';
    END IF;
END $$;

-- Check if updatedAt column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'document_acknowledgments' 
        AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE document_acknowledgments 
        ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column';
    ELSE
        -- Ensure it has a default
        ALTER TABLE document_acknowledgments 
        ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'updatedAt column already exists, ensured default';
    END IF;
END $$;

-- Show final structure
SELECT 'Final table structure:' AS status;
\d document_acknowledgments

EOF

echo ""
echo -e "${GREEN}✓ Table structure fixed!${NC}"
echo ""

echo -e "${YELLOW}Regenerating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Fix Complete!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart the application: pm2 restart br-driver-app"
echo "2. Test document acknowledgment"
echo ""

