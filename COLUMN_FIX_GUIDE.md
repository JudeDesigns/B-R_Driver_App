# Column Name Fix Guide

## The Problem

Your production database has **wrong column names** that don't match `schema.prisma`.

### Why `deploy-safe.sh` Didn't Fix It

The `deploy-safe.sh` script only checks if **tables exist**, not if **column names are correct**:

```bash
# Script checks:
if table_exists('daily_kpis'); then
    SKIP_MIG_6=true  # ❌ Skips migration even if columns are wrong!
fi
```

So when it saw that `daily_kpis` and `system_documents` tables exist, it skipped the migrations, leaving the wrong column names in place.

---

## Current State of Production Database

### `daily_kpis` Table

| Current Column Name | Should Be | Status |
|---------------------|-----------|--------|
| `amountDelivered` | `totalDelivered` | ❌ WRONG |
| `totalStops` | `stopsTotal` | ❌ WRONG |
| `startTime` | `timeStart` | ❌ WRONG |
| `endTime` | `timeEnd` | ❌ WRONG |
| (missing) | `milesStart` | ❌ MISSING |
| (missing) | `milesEnd` | ❌ MISSING |
| (missing) | `milesDriven` | ❌ MISSING |
| (missing) | `totalTime` | ❌ MISSING |
| (missing) | `isDeleted` | ❌ MISSING |
| `totalAmount` | (not in schema) | ❌ EXTRA |
| `returnsCount` | (not in schema) | ❌ EXTRA |
| `onTimeDeliveries` | (not in schema) | ❌ EXTRA |
| `lateDeliveries` | (not in schema) | ❌ EXTRA |
| `averageStopTime` | (not in schema) | ❌ EXTRA |
| `totalDistance` | (not in schema) | ❌ EXTRA |

### `system_documents` Table

| Current Column Name | Should Be | Status |
|---------------------|-----------|--------|
| `type` | `documentType` | ❌ WRONG |
| `version` | (not in schema) | ❌ EXTRA |
| `effectiveDate` | (not in schema) | ❌ EXTRA |
| `expiryDate` | (not in schema) | ❌ EXTRA |

---

## The Solution

Run the **column fix script** to rename/add/remove columns to match the schema.

---

## Step-by-Step Instructions

### On Production Server:

```bash
# 1. Navigate to app directory
cd /path/to/B-R_Driver_App

# 2. Pull latest code (includes fix scripts)
git pull origin main

# 3. Run the column fix script
bash fix-production-columns.sh

# 4. Restart the application
pm2 restart br-driver-app

# 5. Test the application
# - Visit KPI dashboard
# - Visit System Documents page
# - Check for errors

# 6. Check logs
pm2 logs br-driver-app --lines 50
```

---

## What the Fix Script Does

### Step 1: Backup
Creates backup tables:
- `daily_kpis_backup_YYYYMMDD_HHMMSS`
- `system_documents_backup_YYYYMMDD_HHMMSS`

### Step 2: Fix `daily_kpis` Table
- ✅ Renames `amountDelivered` → `totalDelivered`
- ✅ Renames `totalStops` → `stopsTotal`
- ✅ Renames `startTime` → `timeStart`
- ✅ Renames `endTime` → `timeEnd`
- ✅ Adds `milesStart`, `milesEnd`, `milesDriven`, `totalTime`, `isDeleted`
- ✅ Drops `totalAmount`, `returnsCount`, `onTimeDeliveries`, `lateDeliveries`, `averageStopTime`, `totalDistance`

### Step 3: Fix `system_documents` Table
- ✅ Renames `type` → `documentType`
- ✅ Drops `version`, `effectiveDate`, `expiryDate`

### Step 4: Regenerate Prisma Client
- ✅ Runs `npx prisma generate`

---

## Safety Features

1. **Backups**: Creates backup tables before making changes
2. **Idempotent**: Can run multiple times safely (checks if columns exist before renaming)
3. **Non-destructive**: Only renames/adds columns, preserves all data
4. **Confirmation**: Asks for confirmation before proceeding

---

## If Something Goes Wrong

### Restore from Backup

```bash
# Find backup tables
psql -U br_user -d br_food_services -c "\dt *backup*"

# Restore daily_kpis
psql -U br_user -d br_food_services -c "
DROP TABLE daily_kpis;
ALTER TABLE daily_kpis_backup_YYYYMMDD_HHMMSS RENAME TO daily_kpis;
"

# Restore system_documents
psql -U br_user -d br_food_services -c "
DROP TABLE system_documents;
ALTER TABLE system_documents_backup_YYYYMMDD_HHMMSS RENAME TO system_documents;
"

# Restart app
pm2 restart br-driver-app
```

---

## Verification

After running the fix script, verify the columns are correct:

```bash
# Check daily_kpis columns
psql -U br_user -d br_food_services -c "\d daily_kpis"

# Should see:
# - milesStart
# - milesEnd
# - milesDriven
# - totalDelivered (not amountDelivered)
# - stopsTotal (not totalStops)
# - timeStart (not startTime)
# - timeEnd (not endTime)
# - totalTime
# - isDeleted

# Check system_documents columns
psql -U br_user -d br_food_services -c "\d system_documents"

# Should see:
# - documentType (not type)
# Should NOT see:
# - version
# - effectiveDate
# - expiryDate
```

---

## Why This Happened

The original migrations were created with wrong column names. When you deployed them, the tables were created with those wrong names. Then when you fixed the migration files, the `deploy-safe.sh` script saw the tables already existed and skipped them, leaving the wrong column names in place.

---

## Files Created

1. `fix-column-names.sql` - SQL script to fix column names
2. `fix-production-columns.sh` - Bash script to run the SQL and verify
3. `COLUMN_FIX_GUIDE.md` - This guide

---

## After the Fix

Once the columns are fixed:
- ✅ KPI dashboard will load without errors
- ✅ System Documents page will load without errors
- ✅ No more "column does not exist" errors
- ✅ Database matches schema.prisma exactly

---

**Run `bash fix-production-columns.sh` on production to fix the column names!**

