# Migration Deployment Guide

## Overview

This guide explains how to safely deploy the 10 new migrations to your production database. Each migration adds a specific feature and can be applied independently.

## Migration List

| # | Migration Name | Description | Risk Level |
|---|---------------|-------------|------------|
| 1 | `20251227000001_add_payment_terms_to_stops` | Adds payment terms columns to stops table | **LOW** |
| 2 | `20251227000002_add_location_tracking_to_users` | Adds location tracking fields to users table | **LOW** |
| 3 | `20251227000003_add_attendance_integration` | Adds attendance app integration fields | **LOW** |
| 4 | `20251227000004_add_customer_payment_terms` | Adds payment terms to customers table | **LOW** |
| 5 | `20251227000005_create_driver_locations_table` | Creates driver location history table | **MEDIUM** |
| 6 | `20251227000006_create_daily_kpis_table` | Creates KPI tracking table | **MEDIUM** |
| 7 | `20251227000007_create_vehicles_system` | Creates vehicle management tables | **MEDIUM** |
| 8 | `20251227000008_add_document_type_variants` | Adds new document type enum values | **LOW** |
| 9 | `20251227000009_create_file_management_system` | Creates file management tables | **MEDIUM** |
| 10 | `20251227000010_create_system_documents_and_safety` | Creates system docs and safety tables | **MEDIUM** |

## Prerequisites

1. **Backup the production database** (CRITICAL!)
2. **SSH access to production server**
3. **PM2 running the application**
4. **Git repository access**

## Deployment Options

### Option 1: Apply All Migrations at Once (Fastest)

```bash
# On production server
cd /path/to/B-R_Driver_App
git pull origin main
npx prisma migrate deploy
pm2 restart br-driver-app
```

**Pros**: Fast, simple, one command
**Cons**: If something fails, harder to debug which migration caused the issue

---

### Option 2: Apply Migrations One by One (Safest - RECOMMENDED)

Use the provided script to apply migrations individually with verification at each step.

```bash
# On production server
cd /path/to/B-R_Driver_App
git pull origin main
bash apply-migrations-step-by-step.sh
```

The script will:
1. Show you which migration will be applied
2. Ask for confirmation
3. Apply the migration
4. Verify it succeeded
5. Wait for your confirmation before proceeding to the next one

---

### Option 3: Manual One-by-One (Most Control)

Apply each migration manually using SQL:

```bash
# On production server
cd /path/to/B-R_Driver_App

# Apply migration 1
psql -U postgres -d br_driver_app -f prisma/migrations/20251227000001_add_payment_terms_to_stops/migration.sql

# Verify it worked
psql -U postgres -d br_driver_app -c "\d stops" | grep paymentTerms

# Continue with migration 2, 3, etc.
```

---

## Step-by-Step Deployment (Recommended)

### Step 1: Backup Database

```bash
# On production server
pg_dump -U postgres -d br_driver_app > ~/br_driver_app_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh ~/br_driver_app_backup_*.sql
```

### Step 2: Pull Latest Code

```bash
cd /path/to/B-R_Driver_App
git pull origin main
```

### Step 3: Check Migration Status

```bash
npx prisma migrate status
```

You should see 10 pending migrations.

### Step 4: Apply Migrations

**Option A - All at once:**
```bash
npx prisma migrate deploy
```

**Option B - One by one (use the script):**
```bash
bash apply-migrations-step-by-step.sh
```

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

### Step 6: Restart Application

```bash
pm2 restart br-driver-app
```

### Step 7: Verify Application

```bash
# Check logs
pm2 logs br-driver-app --lines 50

# Check if app is running
pm2 status

# Test the application in browser
```

---

## Rollback Plan

If something goes wrong:

### Option 1: Restore from Backup

```bash
# Stop the application
pm2 stop br-driver-app

# Restore database
psql -U postgres -d br_driver_app < ~/br_driver_app_backup_YYYYMMDD_HHMMSS.sql

# Revert code
git reset --hard HEAD~1

# Restart application
pm2 restart br-driver-app
```

### Option 2: Rollback Specific Migration

Prisma doesn't support automatic rollback, but you can manually revert:

```bash
# Example: Rollback migration 5 (driver_locations table)
psql -U postgres -d br_driver_app -c "DROP TABLE IF EXISTS driver_locations CASCADE;"
```

---

## Post-Deployment Verification

After deployment, verify each feature:

1. **Payment Terms**: Upload a route and check if stops have payment terms
2. **Location Tracking**: Check if driver locations are being recorded
3. **KPI Dashboard**: Verify KPI data is being collected
4. **Vehicle Management**: Check if vehicle tables exist
5. **File Management**: Test file upload functionality

---

## Troubleshooting

### Issue: "Migration already applied"

**Solution**: Skip to the next migration or use `npx prisma migrate resolve --applied <migration_name>`

### Issue: "Column already exists"

**Solution**: The migration was partially applied. Check the database schema and manually fix.

### Issue: "Foreign key constraint violation"

**Solution**: Check if referenced tables exist. Apply migrations in order.

### Issue: Application won't start after migration

**Solution**: 
1. Check PM2 logs: `pm2 logs br-driver-app`
2. Verify Prisma client was regenerated: `npx prisma generate`
3. Check for TypeScript errors: `npm run build`

---

## Important Notes

1. **Always backup before migrating**
2. **Test on local/staging first** (if possible)
3. **Apply migrations during low-traffic hours**
4. **Monitor application logs after deployment**
5. **Keep the backup for at least 7 days**

---

## Support

If you encounter issues:
1. Check the error message in PM2 logs
2. Verify database connection
3. Check migration status: `npx prisma migrate status`
4. Review this guide's troubleshooting section

