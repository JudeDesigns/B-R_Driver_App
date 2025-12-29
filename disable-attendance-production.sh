#!/bin/bash

# Disable Attendance System in Production
# This script adds ATTENDANCE_ENABLED=false to the .env file

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Disable Attendance System${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found!${NC}"
    echo "Please run this script from the application root directory."
    exit 1
fi

echo -e "${YELLOW}Updating .env file...${NC}"

# Check if ATTENDANCE_ENABLED already exists
if grep -q "^ATTENDANCE_ENABLED=" .env; then
    # Update existing value
    sed -i.bak 's/^ATTENDANCE_ENABLED=.*/ATTENDANCE_ENABLED=false/' .env
    echo -e "${GREEN}✓ Updated ATTENDANCE_ENABLED=false${NC}"
else
    # Add new line after ATTENDANCE_ENFORCEMENT_MODE
    if grep -q "^ATTENDANCE_ENFORCEMENT_MODE=" .env; then
        sed -i.bak '/^ATTENDANCE_ENFORCEMENT_MODE=/a\
ATTENDANCE_ENABLED=false' .env
        echo -e "${GREEN}✓ Added ATTENDANCE_ENABLED=false${NC}"
    else
        # Add at the end of file
        echo "" >> .env
        echo "# Disable attendance system" >> .env
        echo "ATTENDANCE_ENABLED=false" >> .env
        echo -e "${GREEN}✓ Added ATTENDANCE_ENABLED=false to end of file${NC}"
    fi
fi

# Create backup
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}✓ Attendance System Disabled!${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart the application: pm2 restart br-driver-app"
echo "2. Check logs: pm2 logs br-driver-app --lines 20"
echo ""

echo -e "${GREEN}The attendance polling errors should stop now!${NC}"
echo ""

