#!/bin/bash

# Safe Production Deployment Script
# This script checks what exists in the database and only applies what's needed

set -e  # Exit on error

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
echo -e "${BLUE}  Safe Production Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if column exists
column_exists() {
    local table=$1
    local column=$2
    psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='$table' AND column_name='$column');"
}

# Function to check if table exists
table_exists() {
    local table=$1
    psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');"
}

# Function to check if index exists
index_exists() {
    local index=$1
    psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='$index');"
}

# Function to check if enum type exists
enum_exists() {
    local enum=$1
    psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname='$enum');"
}

echo -e "${YELLOW}Step 1: Checking current database state...${NC}"
echo ""

# Check Migration 1: Payment terms to stops
echo -e "${BLUE}Checking Migration 1: Payment terms to stops${NC}"
if [ "$(column_exists 'stops' 'paymentTerms')" = "t" ]; then
    echo -e "${GREEN}✓ stops.paymentTerms already exists${NC}"
    SKIP_MIG_1=true
else
    echo -e "${YELLOW}✗ stops.paymentTerms missing - will add${NC}"
    SKIP_MIG_1=false
fi

# Check Migration 2: Location tracking to users
echo -e "${BLUE}Checking Migration 2: Location tracking to users${NC}"
if [ "$(column_exists 'users' 'lastKnownLatitude')" = "t" ]; then
    echo -e "${GREEN}✓ users.lastKnownLatitude already exists${NC}"
    SKIP_MIG_2=true
else
    echo -e "${YELLOW}✗ users.lastKnownLatitude missing - will add${NC}"
    SKIP_MIG_2=false
fi

# Check Migration 3: Attendance integration
echo -e "${BLUE}Checking Migration 3: Attendance integration${NC}"
if [ "$(column_exists 'users' 'attendanceAppUserId')" = "t" ]; then
    echo -e "${GREEN}✓ users.attendanceAppUserId already exists${NC}"
    SKIP_MIG_3=true
else
    echo -e "${YELLOW}✗ users.attendanceAppUserId missing - will add${NC}"
    SKIP_MIG_3=false
fi

# Check Migration 4: Customer payment terms
echo -e "${BLUE}Checking Migration 4: Customer payment terms${NC}"
if [ "$(column_exists 'customers' 'paymentTerms')" = "t" ]; then
    echo -e "${GREEN}✓ customers.paymentTerms already exists${NC}"
    SKIP_MIG_4=true
else
    echo -e "${YELLOW}✗ customers.paymentTerms missing - will add${NC}"
    SKIP_MIG_4=false
fi

# Check Migration 5: Driver locations table
echo -e "${BLUE}Checking Migration 5: Driver locations table${NC}"
if [ "$(table_exists 'driver_locations')" = "t" ]; then
    echo -e "${GREEN}✓ driver_locations table already exists${NC}"
    SKIP_MIG_5=true
else
    echo -e "${YELLOW}✗ driver_locations table missing - will create${NC}"
    SKIP_MIG_5=false
fi

# Check Migration 6: Daily KPIs table
echo -e "${BLUE}Checking Migration 6: Daily KPIs table${NC}"
if [ "$(table_exists 'daily_kpis')" = "t" ]; then
    echo -e "${GREEN}✓ daily_kpis table already exists${NC}"
    SKIP_MIG_6=true
else
    echo -e "${YELLOW}✗ daily_kpis table missing - will create${NC}"
    SKIP_MIG_6=false
fi

# Check Migration 7: Vehicles system
echo -e "${BLUE}Checking Migration 7: Vehicles system${NC}"
if [ "$(table_exists 'vehicles')" = "t" ]; then
    echo -e "${GREEN}✓ vehicles table already exists${NC}"
    SKIP_MIG_7=true
else
    echo -e "${YELLOW}✗ vehicles table missing - will create${NC}"
    SKIP_MIG_7=false
fi

# Check Migration 8: Document type variants (skip - enum additions are safe)
echo -e "${BLUE}Checking Migration 8: Document type variants${NC}"
echo -e "${GREEN}✓ Enum additions are safe - will apply${NC}"
SKIP_MIG_8=false

# Check Migration 9: File management system
echo -e "${BLUE}Checking Migration 9: File management system${NC}"
if [ "$(table_exists 'files')" = "t" ]; then
    echo -e "${GREEN}✓ files table already exists${NC}"
    SKIP_MIG_9=true
else
    echo -e "${YELLOW}✗ files table missing - will create${NC}"
    SKIP_MIG_9=false
fi

# Check Migration 10: System documents and safety
echo -e "${BLUE}Checking Migration 10: System documents and safety${NC}"
if [ "$(table_exists 'system_documents')" = "t" ]; then
    echo -e "${GREEN}✓ system_documents table already exists${NC}"
    SKIP_MIG_10=true
else
    echo -e "${YELLOW}✗ system_documents table missing - will create${NC}"
    SKIP_MIG_10=false
fi

echo ""
echo -e "${YELLOW}Step 2: Marking already-applied migrations...${NC}"
echo ""

# Mark migrations as applied if they're already in the database
if [ "$SKIP_MIG_1" = true ]; then
    npx prisma migrate resolve --applied 20251227000001_add_payment_terms_to_stops 2>/dev/null || true
fi

if [ "$SKIP_MIG_2" = true ]; then
    npx prisma migrate resolve --applied 20251227000002_add_location_tracking_to_users 2>/dev/null || true
fi

if [ "$SKIP_MIG_3" = true ]; then
    npx prisma migrate resolve --applied 20251227000003_add_attendance_integration 2>/dev/null || true
fi

if [ "$SKIP_MIG_4" = true ]; then
    npx prisma migrate resolve --applied 20251227000004_add_customer_payment_terms 2>/dev/null || true
fi

if [ "$SKIP_MIG_5" = true ]; then
    npx prisma migrate resolve --applied 20251227000005_create_driver_locations_table 2>/dev/null || true
fi

if [ "$SKIP_MIG_6" = true ]; then
    npx prisma migrate resolve --applied 20251227000006_create_daily_kpis_table 2>/dev/null || true
fi

if [ "$SKIP_MIG_7" = true ]; then
    npx prisma migrate resolve --applied 20251227000007_create_vehicles_system 2>/dev/null || true
fi

if [ "$SKIP_MIG_9" = true ]; then
    npx prisma migrate resolve --applied 20251227000009_create_file_management_system 2>/dev/null || true
fi

if [ "$SKIP_MIG_10" = true ]; then
    npx prisma migrate resolve --applied 20251227000010_create_system_documents_and_safety 2>/dev/null || true
fi

echo -e "${GREEN}✓ Already-applied migrations marked${NC}"
echo ""

echo -e "${YELLOW}Step 3: Applying remaining migrations...${NC}"
echo ""

# Apply remaining migrations
npx prisma migrate deploy

echo ""
echo -e "${GREEN}✓ Migrations applied successfully!${NC}"
echo ""

echo -e "${YELLOW}Step 4: Generating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${GREEN}✓ Prisma client generated!${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Restart the application: pm2 restart br-driver-app"
echo "2. Check logs: pm2 logs br-driver-app --lines 50"
echo "3. Test the application"
echo ""

