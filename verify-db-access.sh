#!/bin/bash

# Database Access Verification Script
# Usage: ./verify-db-access.sh

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
else
    echo "❌ .env file not found!"
    exit 1
fi

echo "🔍 Diagnosing Database Connection..."
echo "-----------------------------------"
echo "Target Database: $DATABASE_URL"

# Extract credentials from DATABASE_URL
# Format: postgresql://USER:PASSWORD@HOST:PORT/DBNAME
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Parsed User: $DB_USER"
echo "Parsed DB: $DB_NAME"

echo -e "\n1️⃣  Testing connection via psql..."
if PGPASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\([^@]*\)@.*/\1/p') psql -h localhost -U $DB_USER -d $DB_NAME -c "\l" > /dev/null 2>&1; then
    echo "✅ Connection SUCCESSFUL! The credentials are correct."
else
    echo "❌ Connection FAILED."
    echo "   Possible causes:"
    echo "   - Wrong password"
    echo "   - User '$DB_USER' does not exist"
    echo "   - Database '$DB_NAME' does not exist"
    echo "   - pg_hba.conf is blocking password authentication"
fi

echo -e "\n2️⃣  Checking pg_hba.conf (requires sudo)..."
PG_HBA=$(sudo find /var/lib/pgsql -name pg_hba.conf | head -n 1)
if [ -z "$PG_HBA" ]; then
    echo "⚠️  Could not find pg_hba.conf automatically."
else
    echo "Found config at: $PG_HBA"
    echo "Checking for 'md5' or 'scram-sha-256' on IPv4/IPv6 local connections..."
    sudo grep "host" $PG_HBA
    
    echo -e "\n👉 TIP: If you see 'ident' or 'peer' for host 127.0.0.1, that is the problem."
    echo "   Change it to 'md5' or 'scram-sha-256' and restart postgresql."
fi
