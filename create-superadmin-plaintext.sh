#!/bin/bash

# SUPER SIMPLE SuperAdmin Creation Script
# Creates user with plain text password - change it after first login!

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
echo -e "${CYAN}  Create SuperAdmin User (Simple)${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Get username
read -p "Enter username: " USERNAME

if [ -z "$USERNAME" ]; then
    echo -e "${RED}Username cannot be empty!${NC}"
    exit 1
fi

# Get password
read -sp "Enter password: " PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
    echo -e "${RED}Password cannot be empty!${NC}"
    exit 1
fi

# Get full name (optional)
read -p "Enter full name (optional): " FULL_NAME

if [ -z "$FULL_NAME" ]; then
    FULL_NAME_SQL="NULL"
else
    FULL_NAME_SQL="'$FULL_NAME'"
fi

echo ""
echo -e "${YELLOW}Creating SuperAdmin user...${NC}"

# Insert user with plain text password
psql -U $DB_USER -d $DB_NAME << EOF
INSERT INTO users (id, username, password, role, "fullName", "createdAt", "updatedAt", "isDeleted")
VALUES (
    gen_random_uuid()::text,
    '$USERNAME',
    '$PASSWORD',
    'SUPER_ADMIN',
    $FULL_NAME_SQL,
    NOW(),
    NOW(),
    false
);
EOF

echo ""
echo -e "${GREEN}✓ SuperAdmin Created!${NC}"
echo ""
echo -e "${BLUE}Username:${NC} $USERNAME"
echo -e "${BLUE}Password:${NC} $PASSWORD"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "1. Log in with these credentials"
echo "2. Change your password immediately through the UI"
echo "3. The password is currently stored as plain text"
echo ""

