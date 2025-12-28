#!/bin/bash

# Check what's actually in the system_documents table

DB_USER="br_user"
DB_NAME="br_food_services"

echo "========================================="
echo "Checking system_documents table structure"
echo "========================================="
echo ""

echo "1. Does the table exist?"
psql -U $DB_USER -d $DB_NAME -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_documents');"

echo ""
echo "2. What columns does it have?"
psql -U $DB_USER -d $DB_NAME -c "\d system_documents"

echo ""
echo "3. List all columns:"
psql -U $DB_USER -d $DB_NAME -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'system_documents' ORDER BY ordinal_position;"

echo ""
echo "4. How many rows?"
psql -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM system_documents;"

echo ""
echo "========================================="
echo "Checking related enums"
echo "========================================="
echo ""

echo "5. Does SystemDocumentType enum exist?"
psql -U $DB_USER -d $DB_NAME -c "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SystemDocumentType');"

echo ""
echo "6. Does DocumentCategory enum exist?"
psql -U $DB_USER -d $DB_NAME -c "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentCategory');"

echo ""
echo "7. List all enum types:"
psql -U $DB_USER -d $DB_NAME -c "SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;"

echo ""
echo "Done!"

