# Product Upload Error Fix Guide

## 🐛 **Root Cause Identified**

The error `Unexpected token '<', "<html> <h"... is not valid JSON` is caused by **Next.js returning an HTML error page** instead of JSON when the API fails.

### **Most Likely Causes:**

1. ✅ **Body Size Limit Exceeded** (MOST LIKELY)
   - Next.js default: 4MB max body size
   - Product Excel files can exceed this
   - Server returns HTML error page instead of JSON

2. ⚠️ **Missing `xlsx` Dependency on Server**
   - The `xlsx` package might not be installed on production
   - Or wrong version installed

3. ⚠️ **Prisma Client Not Generated**
   - After migration, Prisma client needs regeneration
   - Missing models cause runtime errors

4. ⚠️ **Server Memory Issue**
   - Large Excel files cause out-of-memory errors
   - Server crashes and returns HTML error

---

## ✅ **SOLUTION 1: Fix Body Size Limit (RECOMMENDED)**

### **Step 1: Update `next.config.js`**

Add body size configuration to your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config ...
  
  // Add this section:
  experimental: {
    optimizeCss: true,
    // Increase body size limit for file uploads
    serverActions: {
      bodySizeLimit: '10mb', // Increase from default 4mb
    },
  },
  
  // Add API route config
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase body size limit
    },
    responseLimit: '10mb',
  },
};

module.exports = nextConfig;
```

### **Step 2: Deploy to Server**

```bash
# On your local machine
git add next.config.js
git commit -m "Fix: Increase body size limit for product uploads"
git push origin main

# On your AlmaLinux server
ssh your-username@your-server-ip
cd /path/to/B-R_Driver_App
git pull origin main
npm run build
pm2 restart all
```

---

## ✅ **SOLUTION 2: Verify Dependencies**

### **On Your Server, Run:**

```bash
# Check if xlsx is installed
npm list xlsx

# Expected output:
# office_project@0.1.0 /path/to/app
# └── xlsx@0.18.5

# If not found, install it:
npm install xlsx@0.18.5
```

---

## ✅ **SOLUTION 3: Add Better Error Handling**

Update the API route to catch and log errors properly:

### **File: `src/app/api/admin/products/upload/route.ts`**

Add detailed logging:

```typescript
export async function POST(request: NextRequest) {
  try {
    console.log("=== Product Upload Started ===");
    
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    console.log("Auth header present:", !!authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    console.log("User authenticated:", decoded.id);

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    console.log("File received:", file.name, "Size:", file.size, "bytes");

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { message: "File too large. Maximum size is 10MB" },
        { status: 400 }
      );
    }

    // ... rest of the code ...
    
  } catch (error) {
    console.error("=== Product Upload Error ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    return NextResponse.json(
      { 
        message: "Failed to process product upload", 
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name || "Unknown"
      },
      { status: 500 }
    );
  }
}
```

---

## 🔍 **DIAGNOSTIC COMMANDS**

Run these on your **AlmaLinux server** to diagnose the issue:

### **1. Check Server Logs**

```bash
pm2 logs br-drive --lines 100 | grep -i "product\|upload\|error"
```

### **2. Check Node.js Memory**

```bash
pm2 show br-driver-app | grep memory
```

### **3. Test API Directly**

```bash
# Create a small test file
echo "Product Name,SKU,Description,Unit
Test Product,TEST001,Test Description,EA" > test_products.csv

# Test upload (replace YOUR_TOKEN with actual token)
curl -X POST http://localhost:3000/api/admin/products/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test_products.csv"
```

### **4. Check Installed Packages**

```bash
npm list | grep -E "xlsx|prisma|next"
```

---

## 🎯 **Quick Fix Script**

Save this as `fix_product_upload.sh` and run on your server:

```bash
#!/bin/bash

echo "=== Product Upload Fix Script ==="

# Navigate to app directory
cd /path/to/B-R_Driver_App || exit 1

# Stop application
echo "Stopping application..."
pm2 stop all

# Pull latest code
echo "Pulling latest code..."
git pull origin main

# Install/verify dependencies
echo "Verifying dependencies..."
npm install

# Regenerate Prisma client
echo "Regenerating Prisma client..."
npx prisma generate

# Rebuild application
echo "Rebuilding application..."
npm run build

# Restart application
echo "Restarting application..."
pm2 restart all

# Show logs
echo "Showing logs (Ctrl+C to exit)..."
pm2 logs br-drive --lines 50
```

---

## 📊 **Expected Results**

After applying the fix:

✅ Product upload should return JSON (not HTML)
✅ Files up to 10MB should upload successfully
✅ Proper error messages in JSON format
✅ Server logs show detailed error information

---

## 🚨 **If Still Not Working**

Send me these outputs from your server:

1. **Server logs during upload attempt:**
   ```bash
   pm2 logs br-drive --lines 200
   ```

2. **Network tab from browser:**
   - Open DevTools → Network tab
   - Try uploading product file
   - Click on the failed request
   - Copy the Response tab content

3. **Package versions:**
   ```bash
   npm list xlsx next @prisma/client
   ```

4. **File size you're trying to upload:**
   ```bash
   ls -lh /path/to/your/product/file.xlsx
   ```

