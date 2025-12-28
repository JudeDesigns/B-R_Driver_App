#!/bin/bash

# Master Fix Script for All Production Issues
# This script runs all fixes in the correct order

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Database credentials
DB_USER="br_user"
DB_NAME="br_food_services"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Fix All Production Database Issues${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will fix:${NC}"
echo "1. ✅ Customer email constraint (allows multiple empty emails)"
echo "2. ✅ system_documents table structure (adds missing columns)"
echo "3. ✅ document_acknowledgments table (if missing)"
echo ""
echo -e "${GREEN}All fixes are safe and preserve existing data${NC}"
echo ""

read -p "Continue with all fixes? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Fix 1: Customer Email Constraint${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

psql -U $DB_USER -d $DB_NAME -f fix-customer-email-constraint.sql

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Fix 2: system_documents Table${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

psql -U $DB_USER -d $DB_NAME -f fix-system-documents-table.sql

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Fix 3: Regenerate Prisma Client${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

npx prisma generate

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ All Fixes Complete!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Summary of changes:${NC}"
echo "1. ✅ Customer email constraint fixed"
echo "   - Can now update customers with empty emails"
echo "   - Multiple customers can have empty emails"
echo "   - Actual email addresses must still be unique"
echo ""
echo "2. ✅ system_documents table fixed"
echo "   - Added missing columns: title, description, category, fileSize, mimeType, isRequired, uploadedBy"
echo "   - Table now has all 15 required columns"
echo ""
echo "3. ✅ document_acknowledgments table verified"
echo "   - Foreign key constraints recreated"
echo ""
echo "4. ✅ Prisma client regenerated"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart the application:"
echo -e "   ${BLUE}pm2 restart br-driver-app${NC}"
echo ""
echo "2. Test the fixes:"
echo "   - Update a customer's address (should work now)"
echo "   - Visit System Documents page (should load now)"
echo "   - Upload a system document (should work now)"
echo ""
echo "3. Check logs:"
echo -e "   ${BLUE}pm2 logs br-driver-app --lines 50${NC}"
echo ""

echo -e "${GREEN}All done! 🚀${NC}"
echo ""

