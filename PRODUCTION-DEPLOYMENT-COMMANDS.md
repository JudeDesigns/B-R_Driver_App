# 🚀 Production Deployment - Quick Commands

## ⚠️ BEFORE YOU START

**CRITICAL: Backup your database first!**

```bash
# Example backup command (adjust for your setup)
pg_dump -U postgres -d br_driver_app > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 📋 Step-by-Step Production Deployment

### Step 1: SSH into Production Server
```bash
ssh your-production-server
```

### Step 2: Navigate to App Directory
```bash
cd /path/to/B-R_Driver_App
```

### Step 3: Pull Latest Code
```bash
git pull origin main
```

### Step 4: Run Deployment Script
```bash
bash deploy-production-fix.sh
```

**The script will prompt you to confirm database backup.**

---

## 🔧 Manual Deployment (If Script Fails)

If the automated script fails, run these commands manually:

### 1. Pull Code
```bash
git pull origin main
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Apply Database Migration
```bash
npx prisma db execute --file ./fix-document-acknowledgments-production.sql --schema ./prisma/schema.prisma
```

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Build Application
```bash
npm run build
```

### 6. Restart PM2
```bash
pm2 restart br-driver-app
```

### 7. Check Logs
```bash
pm2 logs br-driver-app --lines 50
```

---

## ✅ Verify Deployment

### Check Database Schema
```bash
npx prisma db pull
```

### Check Application Status
```bash
pm2 status
pm2 logs br-driver-app --lines 20
```

### Test Document Acknowledgment
1. Log in as driver
2. Go to system documents
3. Acknowledge a document
4. Should work without errors ✅

### Test Auto-Start Next Stop
1. Complete a stop as a driver
2. Verify only your next stop is activated
3. Other drivers' stops should not be affected ✅

---

## 🆘 Rollback (If Something Goes Wrong)

### Restore Database Backup
```bash
psql -U postgres -d br_driver_app < backup_YYYYMMDD_HHMMSS.sql
```

### Revert Code
```bash
git reset --hard HEAD~1
npm install
npm run build
pm2 restart br-driver-app
```

---

## 📞 Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs br-driver-app`
2. Check database connection: `npx prisma db pull`
3. Verify environment variables: `cat .env`
4. Check disk space: `df -h`

---

## 🎯 Expected Results

After successful deployment:
- ✅ Document acknowledgment works without errors
- ✅ Auto-start only activates current driver's next stop
- ✅ No RCE_RES errors in logs
- ✅ Driver location tracking functional
- ✅ All existing features working normally

