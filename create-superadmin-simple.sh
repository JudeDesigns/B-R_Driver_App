#!/bin/bash

# Simple SuperAdmin User Creation Script (No Node.js dependencies)
# This version uses PostgreSQL's pgcrypto extension for password hashing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Database credentials
DB_USER="br_user"
DB_NAME="br_food_services"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Create SuperAdmin User (Simple)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will create a new SuperAdmin user.${NC}"
echo ""

# ============================================
# Step 1: Get username
# ============================================

echo -e "${BLUE}Step 1: Username${NC}"
echo ""

while true; do
    read -p "Enter username: " USERNAME
    
    if [ -z "$USERNAME" ]; then
        echo -e "${RED}✗ Username cannot be empty!${NC}"
        continue
    fi
    
    # Check if username already exists
    USER_EXISTS=$(psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS(SELECT 1 FROM users WHERE username = '$USERNAME');")
    
    if [ "$USER_EXISTS" = "t" ]; then
        echo -e "${RED}✗ Username '$USERNAME' already exists!${NC}"
        read -p "Try a different username? (yes/no): " retry
        if [ "$retry" != "yes" ]; then
            echo -e "${RED}Aborted.${NC}"
            exit 1
        fi
        continue
    fi
    
    echo -e "${GREEN}✓ Username '$USERNAME' is available${NC}"
    break
done

echo ""

# ============================================
# Step 2: Get password
# ============================================

echo -e "${BLUE}Step 2: Password${NC}"
echo ""
echo -e "${YELLOW}Password requirements:${NC}"
echo "  - Minimum 8 characters"
echo "  - Recommended: Mix of uppercase, lowercase, numbers, symbols"
echo ""

while true; do
    read -sp "Enter password: " PASSWORD
    echo ""
    
    if [ -z "$PASSWORD" ]; then
        echo -e "${RED}✗ Password cannot be empty!${NC}"
        continue
    fi
    
    if [ ${#PASSWORD} -lt 8 ]; then
        echo -e "${RED}✗ Password must be at least 8 characters!${NC}"
        continue
    fi
    
    read -sp "Confirm password: " PASSWORD_CONFIRM
    echo ""
    
    if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
        echo -e "${RED}✗ Passwords do not match!${NC}"
        continue
    fi
    
    echo -e "${GREEN}✓ Password confirmed${NC}"
    break
done

echo ""

# ============================================
# Step 3: Get full name
# ============================================

echo -e "${BLUE}Step 3: Full Name (Optional)${NC}"
echo ""

read -p "Enter full name (or press Enter to skip): " FULL_NAME

echo ""

# ============================================
# Step 4: Confirmation
# ============================================

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Review SuperAdmin Details${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${MAGENTA}Username:${NC}  $USERNAME"
echo -e "${MAGENTA}Password:${NC}  ********** (hidden)"
echo -e "${MAGENTA}Full Name:${NC} ${FULL_NAME:-"(not provided)"}"
echo -e "${MAGENTA}Role:${NC}      SUPER_ADMIN"
echo ""

read -p "Create this SuperAdmin user? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""

# ============================================
# Step 5: Create user with SQL
# ============================================

echo -e "${YELLOW}Creating SuperAdmin user...${NC}"
echo ""

# Escape single quotes in password and full name
PASSWORD_ESCAPED="${PASSWORD//\'/\'\'}"
FULL_NAME_ESCAPED="${FULL_NAME//\'/\'\'}"

# Create SQL for full name
if [ -z "$FULL_NAME" ]; then
    FULL_NAME_SQL="NULL"
else
    FULL_NAME_SQL="'$FULL_NAME_ESCAPED'"
fi

# Insert the user (password will be hashed by the application on first login)
# For now, we'll use a bcrypt hash generated with a simple method
psql -U $DB_USER -d $DB_NAME << EOF
-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert the user with bcrypt-hashed password
INSERT INTO users (id, username, password, role, "fullName", "createdAt", "updatedAt", "isDeleted")
VALUES (
    gen_random_uuid()::text,
    '$USERNAME',
    crypt('$PASSWORD_ESCAPED', gen_salt('bf', 10)),
    'SUPER_ADMIN',
    $FULL_NAME_SQL,
    NOW(),
    NOW(),
    false
);

SELECT '✓ SuperAdmin user created successfully!' AS status;
EOF

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ SuperAdmin User Created Successfully!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${MAGENTA}Login Credentials:${NC}"
echo -e "${BLUE}Username:${NC} $USERNAME"
echo -e "${BLUE}Password:${NC} (the password you entered)"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "1. Store these credentials in a secure password manager"
echo "2. Do NOT share these credentials with anyone"
echo "3. Change the password regularly"
echo "4. Use this account only for administrative tasks"
echo ""

echo -e "${GREEN}You can now log in with these credentials!${NC}"
echo ""

