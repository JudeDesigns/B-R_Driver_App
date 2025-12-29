#!/bin/bash

# Check document_acknowledgments table structure

DB_USER="br_user"
DB_NAME="br_food_services"

echo "========================================="
echo "Checking document_acknowledgments table"
echo "========================================="
echo ""

echo "1. Table structure:"
psql -U $DB_USER -d $DB_NAME -c "\d document_acknowledgments"

echo ""
echo "2. All columns:"
psql -U $DB_USER -d $DB_NAME -c "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'document_acknowledgments' ORDER BY ordinal_position;"

echo ""
echo "Done!"

