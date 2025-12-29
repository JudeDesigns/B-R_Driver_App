#!/bin/bash

# Delete User Script
# This script deletes a user from the database

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
echo -e "${CYAN}  Delete User${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will permanently delete a user from the database.${NC}"
echo ""

# ============================================
# Step 1: Get username
# ============================================

read -p "Enter username to delete: " USERNAME

if [ -z "$USERNAME" ]; then
    echo -e "${RED}✗ Username cannot be empty!${NC}"
    exit 1
fi

# ============================================
# Step 2: Check if user exists
# ============================================

USER_INFO=$(psql -U $DB_USER -d $DB_NAME -tAc "SELECT id, username, role, \"fullName\" FROM users WHERE username = '$USERNAME';")

if [ -z "$USER_INFO" ]; then
    echo -e "${RED}✗ User '$USERNAME' not found!${NC}"
    exit 1
fi

# Parse user info
IFS='|' read -r USER_ID USER_USERNAME USER_ROLE USER_FULLNAME <<< "$USER_INFO"

echo -e "${GREEN}✓ User found:${NC}"
echo -e "  ${BLUE}Username:${NC}  $USER_USERNAME"
echo -e "  ${BLUE}Full Name:${NC} ${USER_FULLNAME:-"(not set)"}"
echo -e "  ${BLUE}Role:${NC}      $USER_ROLE"
echo -e "  ${BLUE}ID:${NC}        $USER_ID"
echo ""

# ============================================
# Step 3: Confirmation
# ============================================

echo -e "${RED}⚠️  WARNING: This action cannot be undone!${NC}"
echo ""

read -p "Are you sure you want to delete this user? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Aborted.${NC}"
    exit 0
fi

echo ""
read -p "Type the username again to confirm: " confirm_username

if [ "$confirm_username" != "$USERNAME" ]; then
    echo -e "${RED}✗ Username does not match. Aborted.${NC}"
    exit 1
fi

echo ""

# ============================================
# Step 4: Delete user
# ============================================

echo -e "${YELLOW}Deleting user...${NC}"

psql -U $DB_USER -d $DB_NAME << EOF
DELETE FROM users WHERE username = '$USERNAME';
EOF

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ User Deleted Successfully!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${BLUE}Deleted user:${NC} $USERNAME"
echo ""

