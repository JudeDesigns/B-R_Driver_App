# Production Deployment Checklist

## Pre-Deployment

- [ ] Read `MIGRATION_SUMMARY.md` to understand what will be deployed
- [ ] Read `MIGRATION_DEPLOYMENT_GUIDE.md` for detailed instructions
- [ ] Verify you have SSH access to production server
- [ ] Verify you have database backup access
- [ ] Schedule deployment during low-traffic hours (if possible)
- [ ] Notify team members about the deployment

---

## Deployment Steps

### 1. Backup (CRITICAL!)

- [ ] SSH into production server: `ssh user@your-server-ip`
- [ ] Navigate to app directory: `cd /path/to/B-R_Driver_App`
- [ ] Create database backup:
  ```bash
  pg_dump -U postgres -d br_driver_app > ~/backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Verify backup file exists: `ls -lh ~/backup_*.sql`
- [ ] Note the backup filename for potential rollback

---

### 2. Pull Latest Code

- [ ] Check current branch: `git branch`
- [ ] Pull latest code: `git pull origin main`
- [ ] Verify code was pulled successfully
- [ ] Check migration files exist: `ls prisma/migrations/ | grep 20251227`

---

### 3. Check Migration Status

- [ ] Run: `npx prisma migrate status`
- [ ] Verify you see 10 pending migrations (20251227000001 through 20251227000010)
- [ ] Verify no other unexpected migrations are pending

---

### 4. Apply Migrations

**Choose ONE option:**

#### Option A: Smart Safe Deployment (RECOMMENDED - Handles Existing Changes)
- [ ] Run: `bash deploy-safe.sh`
- [ ] Script will check what already exists in the database
- [ ] Script will skip migrations for things already there
- [ ] Script will only apply what's needed
- [ ] No "column already exists" errors!

#### Option B: All at Once (Only if database is clean)
- [ ] Run: `npx prisma migrate deploy`
- [ ] Wait for completion (2-5 minutes)
- [ ] Verify all migrations applied successfully
- [ ] **Warning**: Will fail if columns/tables already exist

#### Option C: Step-by-Step (Manual control)
- [ ] Run: `bash apply-migrations-step-by-step.sh`
- [ ] Confirm backup when prompted
- [ ] Review each migration before applying
- [ ] Confirm each migration application
- [ ] Verify each migration succeeds before proceeding

---

### 5. Generate Prisma Client

- [ ] Run: `npx prisma generate`
- [ ] Verify Prisma client generated successfully
- [ ] Check for any errors in output

---

### 6. Restart Application

- [ ] Run: `pm2 restart br-driver-app`
- [ ] Wait for restart to complete
- [ ] Check PM2 status: `pm2 status`
- [ ] Verify app is "online"

---

### 7. Check Logs

- [ ] Run: `pm2 logs br-driver-app --lines 50`
- [ ] Look for any errors (red text)
- [ ] Verify app started successfully
- [ ] Check for database connection errors
- [ ] Press `Ctrl+C` to exit logs

---

## Post-Deployment Verification

### 8. Test Application

- [ ] Open application in browser
- [ ] Login as admin
- [ ] Navigate to route management
- [ ] Upload a test route (with "Cristian" driver if possible)
- [ ] Verify route upload succeeds
- [ ] Check if "Cristian" driver is assigned correctly
- [ ] Verify no "username already exists" error

---

### 9. Test Driver Interface

- [ ] Login as a driver (e.g., Abraham)
- [ ] View today's routes
- [ ] Check if stops are displayed
- [ ] Verify location tracking works (if HTTPS enabled)
- [ ] Test completing a stop
- [ ] Verify no console errors

---

### 10. Test KPI Dashboard

- [ ] Login as admin
- [ ] Navigate to KPI dashboard
- [ ] Verify KPI data is displayed
- [ ] Check if today's date shows correct data
- [ ] Verify no "column does not exist" errors

---

### 11. Test New Features

- [ ] **Payment Terms**: Check if stops have payment terms field
- [ ] **Location Tracking**: Verify driver locations are being recorded
- [ ] **Customer Details**: Check if customers have payment terms
- [ ] **Vehicle Management**: Verify vehicle tables exist (if using this feature)

---

## Rollback Plan (If Needed)

### If Something Goes Wrong:

- [ ] Stop the application: `pm2 stop br-driver-app`
- [ ] Restore database from backup:
  ```bash
  psql -U postgres -d br_driver_app < ~/backup_YYYYMMDD_HHMMSS.sql
  ```
- [ ] Revert code: `git reset --hard HEAD~1`
- [ ] Restart application: `pm2 restart br-driver-app`
- [ ] Verify app is working with old code
- [ ] Document the error for troubleshooting

---

## Common Issues & Solutions

### Issue: "Migration already applied"
- [ ] Run: `npx prisma migrate resolve --applied <migration_name>`
- [ ] Continue with next migration

### Issue: Application won't start
- [ ] Check logs: `pm2 logs br-driver-app`
- [ ] Look for specific error message
- [ ] Verify Prisma client was generated
- [ ] Check database connection

### Issue: "Column already exists"
- [ ] Migration was partially applied
- [ ] Check database schema manually
- [ ] Skip to next migration or resolve manually

### Issue: Route upload still fails
- [ ] Check PM2 logs for specific error
- [ ] Verify all migrations were applied
- [ ] Check migration status: `npx prisma migrate status`
- [ ] Verify Prisma client was regenerated

---

## Success Criteria

Deployment is successful when:

- [x] All 10 migrations applied without errors
- [x] Application starts and runs without errors
- [x] Route upload works (especially with "Cristian" driver)
- [x] Driver can complete stops
- [x] KPI dashboard displays data
- [x] No console errors in browser
- [x] No errors in PM2 logs

---

## Post-Deployment Tasks

- [ ] Monitor application for 30 minutes
- [ ] Check PM2 logs periodically: `pm2 logs br-driver-app`
- [ ] Test all critical features
- [ ] Notify team that deployment is complete
- [ ] Keep backup file for at least 7 days
- [ ] Document any issues encountered
- [ ] Update deployment notes if needed

---

## Emergency Contacts

**If you encounter critical issues:**

1. Check the troubleshooting section in `MIGRATION_DEPLOYMENT_GUIDE.md`
2. Review PM2 logs for specific error messages
3. Check migration status: `npx prisma migrate status`
4. If needed, rollback using the backup
5. Document the issue for future reference

---

## Notes

- Deployment Date: _______________
- Deployed By: _______________
- Backup Filename: _______________
- Any Issues: _______________
- Resolution: _______________

---

**Good luck with the deployment! 🚀**

