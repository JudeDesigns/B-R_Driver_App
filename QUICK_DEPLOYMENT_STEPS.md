# Quick Deployment Steps

## TL;DR - Fast Deployment

```bash
# 1. SSH into production server
ssh user@your-server-ip

# 2. Navigate to app directory
cd /path/to/B-R_Driver_App

# 3. Backup database (CRITICAL!)
pg_dump -U postgres -d br_driver_app > ~/backup_$(date +%Y%m%d_%H%M%S).sql

# 4. Pull latest code
git pull origin main

# 5. Apply all migrations at once (fastest)
npx prisma migrate deploy

# 6. Generate Prisma client
npx prisma generate

# 7. Restart application
pm2 restart br-driver-app

# 8. Check logs
pm2 logs br-driver-app --lines 50
```

---

## Safe Deployment (Step-by-Step)

```bash
# Steps 1-4 same as above

# 5. Apply migrations one by one (safest)
bash apply-migrations-step-by-step.sh

# 6-8 same as above
```

---

## What These Migrations Add

1. ✅ **Payment Terms** - Stops and customers can have payment terms
2. ✅ **Location Tracking** - Real-time driver location tracking
3. ✅ **Attendance Integration** - Integration with attendance app
4. ✅ **KPI Dashboard** - Daily performance metrics for drivers
5. ✅ **Vehicle Management** - Track vehicles and assignments
6. ✅ **File Management** - Advanced file storage with versioning
7. ✅ **System Documents** - Company-wide document management
8. ✅ **Safety Declarations** - Driver safety acknowledgments

---

## Verification Checklist

After deployment, verify:

- [ ] Application starts without errors
- [ ] Route upload works (test with "Cristian" driver)
- [ ] Driver can complete stops
- [ ] KPI dashboard shows data
- [ ] Location tracking works (if HTTPS enabled)
- [ ] No console errors in browser

---

## Rollback (If Needed)

```bash
# Stop app
pm2 stop br-driver-app

# Restore database
psql -U postgres -d br_driver_app < ~/backup_YYYYMMDD_HHMMSS.sql

# Revert code
git reset --hard HEAD~1

# Restart app
pm2 restart br-driver-app
```

---

## Common Issues

**Issue**: "Migration already applied"
**Fix**: Run `npx prisma migrate resolve --applied <migration_name>`

**Issue**: Application won't start
**Fix**: Check `pm2 logs br-driver-app` for errors

**Issue**: "Column already exists"
**Fix**: Migration was partially applied, check database manually

---

## Support Commands

```bash
# Check migration status
npx prisma migrate status

# View database schema
npx prisma db pull

# Check PM2 status
pm2 status

# View logs
pm2 logs br-driver-app

# Restart app
pm2 restart br-driver-app
```

