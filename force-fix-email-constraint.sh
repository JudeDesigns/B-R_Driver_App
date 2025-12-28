#!/bin/bash

# Force Fix Customer Email Constraint
# This is a more aggressive fix that removes ALL email constraints and recreates correctly

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
echo -e "${CYAN}  Force Fix Customer Email Constraint${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will:${NC}"
echo "1. Drop ALL existing email constraints and indexes"
echo "2. Create the correct partial unique index"
echo "3. Verify the fix"
echo ""
echo -e "${GREEN}✓ 100% SAFE - Only changes constraints, preserves all data${NC}"
echo ""

echo -e "${YELLOW}Running fix...${NC}"
echo ""

# Run the SQL fix script
psql -U $DB_USER -d $DB_NAME -f force-fix-email-constraint.sql

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Fix Complete!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}IMPORTANT: You MUST restart the application now!${NC}"
echo ""
echo "Run these commands:"
echo -e "${BLUE}pm2 restart br-driver-app${NC}"
echo -e "${BLUE}pm2 logs br-driver-app --lines 20${NC}"
echo ""

echo "Then test:"
echo "1. Update a customer's address"
echo "2. Should work without email constraint errors"
echo ""

