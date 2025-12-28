#!/bin/bash

# Fix Customer Email Constraint
# This script removes the old unique constraint and adds a partial unique index

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
echo -e "${BLUE}  Fix Customer Email Constraint${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will:${NC}"
echo "1. Remove old unique constraint on customers.email"
echo "2. Create partial unique index that allows multiple empty emails"
echo "3. Verify the fix"
echo ""
echo -e "${GREEN}✓ 100% SAFE - Only changes constraint, preserves all data${NC}"
echo ""

read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${YELLOW}Running fix script...${NC}"
echo ""

# Run the SQL fix script
psql -U $DB_USER -d $DB_NAME -f fix-customer-email-constraint.sql

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Done!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test updating a customer's address"
echo "2. Should work without email constraint errors"
echo ""

