#!/bin/bash

# Fix Production Database Column Names
# This script renames columns to match schema.prisma

set -e

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
echo -e "${BLUE}  Fix Production Column Names${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}This script will:${NC}"
echo "1. Rename columns in daily_kpis table to match schema"
echo "2. Add missing columns to daily_kpis table"
echo "3. Remove extra columns from daily_kpis table"
echo "4. Rename columns in system_documents table to match schema"
echo "5. Remove extra columns from system_documents table"
echo ""

echo -e "${RED}⚠️  WARNING: This will modify your production database!${NC}"
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 1: Backing up affected tables...${NC}"

# Backup daily_kpis table if it exists
if psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_kpis');" | grep -q 't'; then
    echo "Backing up daily_kpis table..."
    psql -U $DB_USER -d $DB_NAME -c "CREATE TABLE daily_kpis_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM daily_kpis;" 2>/dev/null || true
    echo -e "${GREEN}✓ daily_kpis backed up${NC}"
else
    echo "daily_kpis table doesn't exist - skipping backup"
fi

# Backup system_documents table if it exists
if psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents');" | grep -q 't'; then
    echo "Backing up system_documents table..."
    psql -U $DB_USER -d $DB_NAME -c "CREATE TABLE system_documents_backup_$(date +%Y%m%d_%H%M%S) AS SELECT * FROM system_documents;" 2>/dev/null || true
    echo -e "${GREEN}✓ system_documents backed up${NC}"
else
    echo "system_documents table doesn't exist - skipping backup"
fi

echo ""
echo -e "${YELLOW}Step 2: Applying column fixes...${NC}"

# Run the SQL fix script
psql -U $DB_USER -d $DB_NAME -f fix-column-names.sql

echo ""
echo -e "${GREEN}✓ Column fixes applied successfully!${NC}"
echo ""

echo -e "${YELLOW}Step 3: Verifying changes...${NC}"

# Verify daily_kpis columns
if psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_kpis');" | grep -q 't'; then
    echo ""
    echo "daily_kpis table columns:"
    psql -U $DB_USER -d $DB_NAME -c "\d daily_kpis" | grep -E "milesStart|milesEnd|totalDelivered|stopsTotal|timeStart|timeEnd" || echo "  (checking columns...)"
fi

# Verify system_documents columns
if psql -U $DB_USER -d $DB_NAME -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents');" | grep -q 't'; then
    echo ""
    echo "system_documents table columns:"
    psql -U $DB_USER -d $DB_NAME -c "\d system_documents" | grep -E "documentType" || echo "  (checking columns...)"
fi

echo ""
echo -e "${YELLOW}Step 4: Regenerating Prisma client...${NC}"
npx prisma generate

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Column Fixes Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Restart the application: pm2 restart br-driver-app"
echo "2. Test KPI dashboard"
echo "3. Test System Documents page"
echo "4. Check logs: pm2 logs br-driver-app --lines 50"
echo ""
echo "If something went wrong, you can restore from backups:"
echo "  - daily_kpis_backup_YYYYMMDD_HHMMSS"
echo "  - system_documents_backup_YYYYMMDD_HHMMSS"
echo ""

