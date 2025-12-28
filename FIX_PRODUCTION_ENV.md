# Fix Production .env File

## ⚠️ CRITICAL ISSUE

Your production `.env` file is pointing to the **WRONG DATABASE**!

---

## Current (WRONG) Configuration

```env
DATABASE_URL="postgresql://postgres:BRFOODSERVICES156800@localhost:5432/br_driver_app?schema=public"
```

This is connecting to:
- ❌ Database: `br_driver_app` (WRONG - this is your local database name)
- ❌ User: `postgres` (WRONG - production uses `br_user`)

---

## Correct Configuration

```env
DATABASE_URL="postgresql://br_user:YOUR_PASSWORD@localhost:5432/br_food_services?schema=public"
```

This should connect to:
- ✅ Database: `br_food_services` (production database)
- ✅ User: `br_user` (production database user)

---

## How to Fix

### On Production Server:

```bash
# 1. Navigate to app directory
cd /path/to/B-R_Driver_App

# 2. Edit the .env file
nano .env

# 3. Find the DATABASE_URL line and change it to:
DATABASE_URL="postgresql://br_user:YOUR_PASSWORD@localhost:5432/br_food_services?schema=public"

# Replace YOUR_PASSWORD with the actual password for br_user

# 4. Save and exit (Ctrl+X, then Y, then Enter)

# 5. Restart the application
pm2 restart br-driver-app
```

---

## How to Find the Correct Password

If you don't know the password for `br_user`, check:

### Option 1: Check existing .env backup
```bash
cat .env.backup
cat .env.production
```

### Option 2: Check PostgreSQL user
```bash
sudo -u postgres psql
\du  # List all users
\q   # Quit
```

### Option 3: Reset the password
```bash
sudo -u postgres psql
ALTER USER br_user WITH PASSWORD 'new_password';
\q
```

Then update `.env` with the new password.

---

## Why This Matters

If your production app is connecting to `br_driver_app` database instead of `br_food_services`:

1. ❌ It's using the WRONG database
2. ❌ All your production data is in `br_food_services`, not `br_driver_app`
3. ❌ The app won't find any routes, customers, or data
4. ❌ Migrations are being applied to the wrong database

---

## Verify the Fix

After updating `.env` and restarting:

```bash
# Check the logs
pm2 logs br-driver-app --lines 50

# You should NOT see:
# - "Table does not exist" errors
# - "Column does not exist" errors

# Test the application:
# - Login should work
# - Routes should load
# - KPI dashboard should work
# - System documents should work
```

---

## Complete Fix Checklist

- [ ] Update `.env` to use `br_food_services` database
- [ ] Update `.env` to use `br_user` user
- [ ] Verify password is correct
- [ ] Restart PM2: `pm2 restart br-driver-app`
- [ ] Run column fix script: `bash fix-production-columns.sh`
- [ ] Restart PM2 again: `pm2 restart br-driver-app`
- [ ] Test the application
- [ ] Check logs for errors

---

**This is a CRITICAL fix! Your app is currently connecting to the wrong database!**

