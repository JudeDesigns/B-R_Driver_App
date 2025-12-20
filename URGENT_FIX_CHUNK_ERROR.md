# 🚨 URGENT: Fix Chunk Loading Error

## The Problem

Error: `TypeError: Cannot read properties of undefined (reading 'a')` with digest `1340150474`

This is a **Next.js chunk loading failure** that breaks your entire application, including product uploads.

---

## Root Cause

When you deploy to your server, you're likely doing:
```bash
git pull origin main
pm2 restart all
```

**This is WRONG!** ❌

You're **NOT rebuilding** the application on the server, so:
- Old `.next` build artifacts remain
- New code doesn't match old chunks
- Browser tries to load missing chunks
- Next.js returns HTML error page
- Everything breaks

---

## ✅ CORRECT Deployment Process

### **Option 1: Use the Deployment Script (RECOMMENDED)**

You already have `deploy-to-server.sh` in your repo! Use it:

```bash
# On your AlmaLinux server
cd /path/to/B-R_Driver_App

# Make script executable (first time only)
chmod +x deploy-to-server.sh

# Run deployment
./deploy-to-server.sh
```

This script will:
1. ✅ Pull latest code
2. ✅ Install dependencies with `npm ci`
3. ✅ Build application with `npm run build`
4. ✅ Run database migrations
5. ✅ Restart PM2 with zero downtime

---

### **Option 2: Manual Deployment (If script doesn't work)**

```bash
# On your AlmaLinux server
cd /path/to/B-R_Driver_App

# Stop application
pm2 stop all

# Pull latest code
git pull origin main

# Clean old build
rm -rf .next

# Install dependencies
npm ci

# Generate Prisma Client
npx prisma generate

# Build application
npm run build

# Restart application
pm2 restart all

# Check logs
pm2 logs br-drive --lines 50
```

---

## 🎯 Why This Happens

### **Your Current Process (BROKEN):**
```
Local: Code changes → git push
Server: git pull → pm2 restart
```

**Problem:** No rebuild! Old chunks + new code = CRASH

### **Correct Process:**
```
Local: Code changes → git push
Server: git pull → npm run build → pm2 restart
```

**Solution:** Rebuild creates new chunks that match new code

---

## 📋 Step-by-Step Fix RIGHT NOW

### **Step 1: Push your local changes**

```bash
# On your local machine (where I am)
git add .
git commit -m "Fix: Add body size limit and enhanced logging"
git push origin main
```

### **Step 2: Deploy to server**

```bash
# SSH into your server
ssh your-username@your-server-ip

# Navigate to app
cd /path/to/B-R_Driver_App

# Run deployment script
./deploy-to-server.sh
```

**If the script fails**, run the manual commands from Option 2 above.

---

## 🔍 Verify the Fix

After deployment, check:

### **1. No more chunk errors**
```bash
pm2 logs br-drive --lines 50
```

You should **NOT** see:
```
⨯ [TypeError: Cannot read properties of undefined (reading 'a')]
```

### **2. Product upload works**

1. Go to your app in browser
2. Navigate to `/admin/products/upload`
3. Upload your 1.2MB CSV file
4. Should see success message (not HTML error)

### **3. Check server logs during upload**

```bash
pm2 logs br-drive --lines 0
```

Then upload a product file. You should see:
```
=== Product Upload Started ===
Product upload by user: xxx (ADMIN)
File received: products.csv, Size: 1258291 bytes (1.20 MB)
Converting file to buffer...
Parsing product file...
Parsed 150 products from file
Processing products...
Products processed: 120 added, 30 updated, 0 failed
=== Product Upload Completed Successfully ===
```

---

## 🚨 CRITICAL: Never Skip the Build Step

**ALWAYS** run `npm run build` after pulling code changes!

### **Bad Deployment:**
```bash
git pull
pm2 restart all  # ❌ WRONG!
```

### **Good Deployment:**
```bash
git pull
npm run build    # ✅ REQUIRED!
pm2 restart all
```

---

## 📝 Create Deployment Alias (Optional)

Add this to your `~/.bashrc` on the server:

```bash
alias deploy-br='cd /path/to/B-R_Driver_App && ./deploy-to-server.sh'
```

Then reload:
```bash
source ~/.bashrc
```

Now you can deploy with just:
```bash
deploy-br
```

---

## ✅ Summary

**Problem:** Chunk loading error + product upload HTML error  
**Root Cause:** Deploying without rebuilding  
**Solution:** Use `deploy-to-server.sh` or manual build process  
**Status:** Ready to fix - just run the deployment script!

---

## 🎯 Next Steps

1. ✅ Push local changes to git
2. ✅ SSH into server
3. ✅ Run `./deploy-to-server.sh`
4. ✅ Test product upload
5. ✅ Verify no chunk errors in logs

**This will fix BOTH issues at once!** 🚀

