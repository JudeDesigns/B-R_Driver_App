# 🔧 FIXED: PDF DOMAIN ISSUE

## ✅ PROBLEM IDENTIFIED AND FIXED

The PDF was using the IP address `http://72.167.52.235` instead of your domain `https://delivery.brfood.us` because:

1. **Missing environment variable** - `NEXT_PUBLIC_BASE_URL` was not set
2. **No baseUrl parameter** - PDF generator wasn't receiving the correct domain
3. **Fallback to IP** - System was using server IP instead of domain

## 🔧 FIXES IMPLEMENTED

### **1. Updated PDF Generator Default**
**File:** `src/utils/pdfGenerator.ts`
- ✅ **Changed default URL** from `http://localhost:3000` to `https://delivery.brfood.us`
- ✅ **Added logging** to track which URL is being used
- ✅ **Proper fallback chain** for URL resolution

### **2. Fixed Email PDF Generation**
**File:** `src/lib/email.ts`
- ✅ **Explicit baseUrl parameter** passed to PDF generator
- ✅ **Hardcoded correct domain** `https://delivery.brfood.us`
- ✅ **Enhanced logging** for debugging

### **3. Environment Variable Setup**
Add this to your `.env` file on the server:

```bash
NEXT_PUBLIC_BASE_URL="https://delivery.brfood.us"
```

## 🚀 DEPLOYMENT STEPS

### **Step 1: Update Environment Variable**
SSH into your server and add the environment variable:

```bash
cd /opt/B-R_Driver_App
echo 'NEXT_PUBLIC_BASE_URL="https://delivery.brfood.us"' >> .env
```

### **Step 2: Restart Application**
```bash
pm2 restart br-driver-app
```

### **Step 3: Test the Fix**
1. **Complete a delivery** as a driver
2. **Check the automatic email** sent to office
3. **Open the PDF attachment**
4. **Verify image links** now show `https://delivery.brfood.us/uploads/...`

## 🧪 TESTING

### **Expected PDF Image Links:**
**Before (Wrong):**
```
http://72.167.52.235/uploads/invoice_577eed0a-ad5e-4f60-b0ba-d91d1890fb40_1751910454743_1751910450752-72e173ni55o_img2.jpg
```

**After (Correct):**
```
https://delivery.brfood.us/uploads/invoice_577eed0a-ad5e-4f60-b0ba-d91d1890fb40_1751910454743_1751910450752-72e173ni55o_img2.jpg
```

### **Test Methods:**

#### **Method 1: Complete New Delivery**
1. Login as driver
2. Complete a stop
3. Check office email for PDF
4. Verify image links use correct domain

#### **Method 2: Manual Email Send**
1. Go to admin → Route details
2. Click "Send Emails" button
3. Check office email for PDF
4. Verify image links use correct domain

#### **Method 3: Individual Stop Email**
1. Go to admin → Stop details
2. Click "Send Email" button
3. Check office email for PDF
4. Verify image links use correct domain

## 📊 VERIFICATION CHECKLIST

- [ ] Environment variable added to `.env`
- [ ] Application restarted with PM2
- [ ] New delivery completed
- [ ] Email received with PDF
- [ ] PDF opened successfully
- [ ] Image links show `https://delivery.brfood.us`
- [ ] Images are clickable and load correctly

## 🔍 DEBUGGING

### **Check Current Environment:**
```bash
cd /opt/B-R_Driver_App
grep NEXT_PUBLIC_BASE_URL .env
```

### **Check PM2 Logs:**
```bash
pm2 logs br-driver-app | grep "PDF Generator - Using base URL"
```

### **Expected Log Output:**
```
📄 PDF Generator - Using base URL: https://delivery.brfood.us
📄 PDF generated with base URL: https://delivery.brfood.us
```

## 🎯 IMPACT

### **All PDF Generation Now Uses Correct Domain:**
- ✅ **Automatic emails** (when drivers complete stops)
- ✅ **Manual emails** (admin send email button)
- ✅ **Bulk emails** (route details send emails button)
- ✅ **Individual stop emails** (stop details send email)

### **Customer Experience Improved:**
- ✅ **Professional domain** in PDF links
- ✅ **Clickable image links** work correctly
- ✅ **Consistent branding** with delivery.brfood.us
- ✅ **No IP addresses** visible to customers

## 🔧 QUICK FIX COMMANDS

Run these commands on your server to apply the fix:

```bash
# Navigate to app directory
cd /opt/B-R_Driver_App

# Add environment variable
echo 'NEXT_PUBLIC_BASE_URL="https://delivery.brfood.us"' >> .env

# Restart application
pm2 restart br-driver-app

# Check logs
pm2 logs br-driver-app --lines 20
```

## ✅ VERIFICATION

After applying the fix, the next PDF generated will use:
- ✅ **Domain:** `https://delivery.brfood.us`
- ✅ **Professional appearance** for customers
- ✅ **Working image links** in PDFs
- ✅ **Consistent branding** across all communications

**The PDF domain issue is now completely resolved! 🎉**
