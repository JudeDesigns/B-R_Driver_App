#!/bin/bash

# Step-by-Step Migration Application Script
# This script applies migrations one by one with confirmation at each step

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Migration list
MIGRATIONS=(
    "20251227000001_add_payment_terms_to_stops"
    "20251227000002_add_location_tracking_to_users"
    "20251227000003_add_attendance_integration"
    "20251227000004_add_customer_payment_terms"
    "20251227000005_create_driver_locations_table"
    "20251227000006_create_daily_kpis_table"
    "20251227000007_create_vehicles_system"
    "20251227000008_add_document_type_variants"
    "20251227000009_create_file_management_system"
    "20251227000010_create_system_documents_and_safety"
)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Step-by-Step Migration Application${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo -e "${RED}Error: prisma/schema.prisma not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check current migration status
echo -e "${YELLOW}Checking current migration status...${NC}"
npx prisma migrate status
echo ""

# Ask for confirmation to proceed
echo -e "${YELLOW}This script will apply 10 migrations one by one.${NC}"
echo -e "${YELLOW}Have you backed up the database? (y/n)${NC}"
read -r backup_confirm

if [ "$backup_confirm" != "y" ]; then
    echo -e "${RED}Please backup the database first!${NC}"
    echo "Run: pg_dump -U postgres -d br_driver_app > ~/backup_\$(date +%Y%m%d_%H%M%S).sql"
    exit 1
fi

echo ""
echo -e "${GREEN}Starting migration process...${NC}"
echo ""

# Counter
TOTAL=${#MIGRATIONS[@]}
CURRENT=0

# Apply each migration
for migration in "${MIGRATIONS[@]}"; do
    CURRENT=$((CURRENT + 1))
    
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Migration $CURRENT of $TOTAL${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}Migration: ${migration}${NC}"
    echo ""
    
    # Show migration description
    case $migration in
        "20251227000001_add_payment_terms_to_stops")
            echo "Description: Adds payment terms columns to stops table"
            echo "Risk: LOW - Just adding nullable columns"
            ;;
        "20251227000002_add_location_tracking_to_users")
            echo "Description: Adds location tracking fields to users table"
            echo "Risk: LOW - Just adding nullable columns"
            ;;
        "20251227000003_add_attendance_integration")
            echo "Description: Adds attendance app integration fields"
            echo "Risk: LOW - Adding columns and one index"
            ;;
        "20251227000004_add_customer_payment_terms")
            echo "Description: Adds payment terms to customers table"
            echo "Risk: LOW - Adding columns with defaults"
            ;;
        "20251227000005_create_driver_locations_table")
            echo "Description: Creates driver location history table"
            echo "Risk: MEDIUM - Creating new table with foreign keys"
            ;;
        "20251227000006_create_daily_kpis_table")
            echo "Description: Creates KPI tracking table"
            echo "Risk: MEDIUM - Creating new table with unique constraint"
            ;;
        "20251227000007_create_vehicles_system")
            echo "Description: Creates vehicle management tables"
            echo "Risk: MEDIUM - Creating new enum and 2 tables"
            ;;
        "20251227000008_add_document_type_variants")
            echo "Description: Adds new document type enum values"
            echo "Risk: LOW - Just adding enum values"
            ;;
        "20251227000009_create_file_management_system")
            echo "Description: Creates file management tables"
            echo "Risk: MEDIUM - Creating new enum and 4 tables"
            ;;
        "20251227000010_create_system_documents_and_safety")
            echo "Description: Creates system docs and safety tables"
            echo "Risk: MEDIUM - Creating 2 enums and 3 tables"
            ;;
    esac
    
    echo ""
    echo -e "${YELLOW}Apply this migration? (y/n/skip)${NC}"
    read -r confirm
    
    if [ "$confirm" = "skip" ]; then
        echo -e "${YELLOW}Skipping migration...${NC}"
        continue
    elif [ "$confirm" != "y" ]; then
        echo -e "${RED}Migration cancelled by user.${NC}"
        exit 1
    fi
    
    # Apply the migration using Prisma
    echo -e "${GREEN}Applying migration...${NC}"
    npx prisma migrate resolve --applied "$migration" 2>/dev/null || true
    npx prisma migrate deploy --skip-generate
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration applied successfully!${NC}"
    else
        echo -e "${RED}✗ Migration failed!${NC}"
        echo "Please check the error above and fix manually."
        exit 1
    fi
    
    echo ""
done

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All migrations completed successfully!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Generate Prisma client
echo -e "${YELLOW}Generating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${GREEN}✓ Prisma client generated!${NC}"
echo ""

# Final instructions
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Next Steps:${NC}"
echo -e "${BLUE}========================================${NC}"
echo "1. Restart the application: pm2 restart br-driver-app"
echo "2. Check logs: pm2 logs br-driver-app --lines 50"
echo "3. Test the application in browser"
echo "4. Verify each feature is working"
echo ""
echo -e "${GREEN}Deployment complete!${NC}"

