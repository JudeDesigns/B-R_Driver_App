# Safe Deployment Script - README

## Overview

The `deploy-safe.sh` script is a smart deployment tool that:
- ✅ **Checks what already exists** in your production database
- ✅ **Skips migrations** for things that are already there
- ✅ **Only applies what's needed** - no duplicate errors
- ✅ **Automatically marks** already-applied migrations
- ✅ **Handles partial migrations** gracefully

---

## How It Works

### Step 1: Database Inspection
The script checks if each migration's changes already exist:
- Checks if columns exist (e.g., `stops.paymentTerms`)
- Checks if tables exist (e.g., `driver_locations`)
- Checks if indexes exist
- Checks if enum types exist

### Step 2: Smart Marking
For migrations where changes already exist:
- Marks them as "applied" in Prisma's migration history
- Prevents Prisma from trying to apply them again
- Avoids "column already exists" errors

### Step 3: Safe Application
Only applies migrations that haven't been applied yet:
- Skips already-applied migrations
- Applies new migrations
- Handles errors gracefully

### Step 4: Finalization
- Generates Prisma client
- Shows you what to do next

---

## Usage

### On Production Server:

```bash
# 1. Navigate to app directory
cd /path/to/B-R_Driver_App

# 2. Pull latest code
git pull origin main

# 3. Run the safe deployment script
bash deploy-safe.sh

# 4. Restart the application
pm2 restart br-driver-app

# 5. Check logs
pm2 logs br-driver-app --lines 50
```

---

## What It Checks

### Migration 1: Payment Terms to Stops
- ✅ Checks if `stops.paymentTerms` column exists
- ✅ Checks if `stops.paymentTermsOther` column exists

### Migration 2: Location Tracking to Users
- ✅ Checks if `users.lastKnownLatitude` column exists

### Migration 3: Attendance Integration
- ✅ Checks if `users.attendanceAppUserId` column exists

### Migration 4: Customer Payment Terms
- ✅ Checks if `customers.paymentTerms` column exists

### Migration 5: Driver Locations Table
- ✅ Checks if `driver_locations` table exists

### Migration 6: Daily KPIs Table
- ✅ Checks if `daily_kpis` table exists

### Migration 7: Vehicles System
- ✅ Checks if `vehicles` table exists

### Migration 8: Document Type Variants
- ✅ Always applies (enum additions are safe and idempotent)

### Migration 9: File Management System
- ✅ Checks if `files` table exists

### Migration 10: System Documents and Safety
- ✅ Checks if `system_documents` table exists

---

## Example Output

```
========================================
  Safe Production Deployment
========================================

Step 1: Checking current database state...

Checking Migration 1: Payment terms to stops
✓ stops.paymentTerms already exists

Checking Migration 2: Location tracking to users
✓ users.lastKnownLatitude already exists

Checking Migration 3: Attendance integration
✗ users.attendanceAppUserId missing - will add

Checking Migration 4: Customer payment terms
✗ customers.paymentTerms missing - will add

Checking Migration 5: Driver locations table
✗ driver_locations table missing - will create

Checking Migration 6: Daily KPIs table
✗ daily_kpis table missing - will create

...

Step 2: Marking already-applied migrations...
✓ Already-applied migrations marked

Step 3: Applying remaining migrations...
✓ Migrations applied successfully!

Step 4: Generating Prisma client...
✓ Prisma client generated!

========================================
Deployment Complete!
========================================
```

---

## Database Configuration

The script is configured for your production environment:
- **Database User**: `br_user`
- **Database Name**: `br_food_services`

If these change, edit the script:
```bash
DB_USER="br_user"
DB_NAME="br_food_services"
```

---

## Advantages Over Standard Deployment

### Standard `npx prisma migrate deploy`:
- ❌ Fails if columns already exist
- ❌ Stops at first error
- ❌ Requires manual intervention
- ❌ No visibility into what exists

### `deploy-safe.sh`:
- ✅ Checks what exists first
- ✅ Skips already-applied changes
- ✅ Continues even if some migrations are partial
- ✅ Shows you exactly what will be done
- ✅ Handles the `20251220060000_fix_missing_columns` situation automatically

---

## Safety Features

1. **Non-destructive**: Never drops or deletes anything
2. **Idempotent**: Can run multiple times safely
3. **Transparent**: Shows you what it's checking and doing
4. **Fail-safe**: Exits on errors to prevent corruption
5. **Database-aware**: Uses actual database state, not just migration history

---

## Troubleshooting

### Issue: "psql: FATAL: Peer authentication failed"
**Solution**: The script uses `psql -U br_user`, which should work with your `.env` credentials. If it fails, you may need to set `PGPASSWORD`:
```bash
export PGPASSWORD='your_password'
bash deploy-safe.sh
```

### Issue: "Permission denied"
**Solution**: Make the script executable:
```bash
chmod +x deploy-safe.sh
```

### Issue: Script says everything exists but app still has errors
**Solution**: Check if the columns/tables actually have the right structure:
```bash
psql -U br_user -d br_food_services -c "\d users"
psql -U br_user -d br_food_services -c "\d stops"
```

---

## When to Use This Script

Use `deploy-safe.sh` when:
- ✅ You're not sure what's already in the production database
- ✅ You've had partial migrations applied before
- ✅ You've manually added columns/tables
- ✅ You've rolled back migrations but the changes are still there
- ✅ You want to avoid "column already exists" errors
- ✅ You want visibility into what will be applied

Use standard `npx prisma migrate deploy` when:
- ✅ You're 100% sure the database is in sync with migration history
- ✅ This is a fresh database
- ✅ You've never had migration issues before

---

## What Happens to Already-Existing Changes

If the script finds that a migration's changes already exist:
1. It marks the migration as "applied" in `_prisma_migrations` table
2. Prisma will skip it during `migrate deploy`
3. No errors occur
4. The existing columns/tables remain unchanged

---

## Post-Deployment

After running the script:
1. ✅ Restart your application: `pm2 restart br-driver-app`
2. ✅ Check logs: `pm2 logs br-driver-app --lines 50`
3. ✅ Test route upload
4. ✅ Test customer address update
5. ✅ Test KPI dashboard
6. ✅ Verify no errors in browser console

---

## Support

If the script encounters issues:
1. Read the error message carefully
2. Check which migration failed
3. Manually inspect the database: `psql -U br_user -d br_food_services`
4. Check the migration file to see what it's trying to do
5. Manually apply or skip as needed

---

**This script solves the exact problem you're facing: safely deploying migrations when you're not sure what's already in the database!**

