# Invoice Image 404 Error - Root Cause Analysis

**Date:** 2026-01-25  
**Issue:** Cannot open invoice image - Shows "404 Not Found"  
**Stop:** #9 - WholeSum Foods LLC  
**Date:** Jan 14, 2026  
**Driver:** Luis  
**Status:** 🔴 **CRITICAL - Image not accessible**

---

## 🎯 **Problem Statement**

When trying to open an invoice image for a stop, the system returns a **404 Not Found** error. The image exists in the PDF (can be extracted manually), but the URL stored in the database is not accessible.

---

## 🔍 **Potential Root Causes**

### **Cause 1: File Path Mismatch (MOST LIKELY)**

**Probability:** 🔴 **90%**

**Explanation:**
The image URL stored in the database doesn't match the actual file location on the server.

**How it happens:**

<augment_code_snippet path="src/app/api/driver/stops/[id]/upload/route.ts" mode="EXCERPT">
````typescript
// Line 159: Filename generation
const fileName = `invoice_${stop.id}_${timestamp}_${sessionId}_img${imageIndex + 1}`;

// Line 162-163: Files saved to public/uploads/
const uploadsDir = path.join(process.cwd(), "public", "uploads");

// Line 173-180: Image saved with .jpg extension
const imageFilePath = path.join(uploadsDir, `${fileName}.jpg`);
await writeFileAsync(imageFilePath, Buffer.from(fileBuffer));

// Line 182: URL stored in database
const imageUrl = `/uploads/${fileName}.jpg`;
````
</augment_code_snippet>

**Expected file location:** `/public/uploads/invoice_STOPID_TIMESTAMP_SESSIONID_img1.jpg`  
**Expected URL:** `/uploads/invoice_STOPID_TIMESTAMP_SESSIONID_img1.jpg`

**Possible issues:**
1. ❌ File was saved with different extension (e.g., `.png` instead of `.jpg`)
2. ❌ File was saved to wrong directory (e.g., `uploads/images/` instead of `uploads/`)
3. ❌ Filename has special characters that break the URL
4. ❌ File was deleted or moved after upload

---

### **Cause 2: Missing File on Server (LIKELY)**

**Probability:** 🟡 **70%**

**Explanation:**
The file was uploaded successfully and the URL was saved to the database, but the physical file is missing from the server.

**How it happens:**
1. File uploaded successfully → URL saved to database
2. Server restart or deployment → `public/uploads/` directory cleared
3. Manual cleanup script deleted old files
4. Disk space issue caused file deletion
5. File permissions issue prevents reading

**Evidence to check:**
- Does the file exist at: `public/uploads/invoice_[STOP_ID]_*.jpg`?
- Check server logs for file deletion events
- Check disk space on server

---

### **Cause 3: Incorrect Base URL (MEDIUM)**

**Probability:** 🟡 **50%**

**Explanation:**
The URL stored in the database is relative (e.g., `/uploads/image.jpg`), but the server is not serving static files from the correct location.

<augment_code_snippet path="server.js" mode="EXCERPT">
````javascript
// Lines 31-51: Custom static file serving
if (pathname.startsWith("/uploads/")) {
  const filePath = path.join(process.cwd(), "public", pathname);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
    return;
  }
}
````
</augment_code_snippet>

**Possible issues:**
1. ❌ Server is running in production mode without custom static file handler
2. ❌ `process.cwd()` points to wrong directory
3. ❌ Nginx/reverse proxy not configured to serve `/uploads/` directory
4. ❌ File permissions prevent Node.js from reading the file

---

### **Cause 4: Database URL Corruption (LOW)**

**Probability:** 🟢 **20%**

**Explanation:**
The URL stored in the database is malformed or corrupted.

**How it happens:**
1. URL saved with extra characters: `/uploads//image.jpg` (double slash)
2. URL saved with wrong prefix: `uploads/image.jpg` (missing leading slash)
3. URL saved with absolute path: `/var/www/app/public/uploads/image.jpg`
4. URL encoding issues: `/uploads/image%20(1).jpg`

**Database field:**

<augment_code_snippet path="prisma/schema.prisma" mode="EXCERPT">
````prisma
model Stop {
  // Line 224: Array of image URLs
  invoiceImageUrls  String[]  @default([])
  
  // Line 209: PDF URL
  signedInvoicePdfUrl  String?
}
````
</augment_code_snippet>

---

### **Cause 5: Image Embedded in PDF Only (MEDIUM)**

**Probability:** 🟡 **60%**

**Explanation:**
The image was embedded directly into the PDF without saving the original image file separately.

**How it happens:**

<augment_code_snippet path="src/utils/pdfGenerator.ts" mode="EXCERPT">
````typescript
// Lines 301-366: PDF generation process
export async function generateDeliveryPDF(
  stop: Stop,
  imageUrls: ImageUrl[],
  returns: ReturnItem[],
  baseUrl?: string
): Promise<Buffer> {
  // Images are converted to base64 and embedded in PDF
  const embeddedImages = await Promise.all(
    imageUrls.map(async (img) => {
      // ... converts image to base64
    })
  );
  
  // PDF generated with embedded images
  return await generatePDFWithRetry(stop, embeddedImages, returns, baseUrl);
}
````
</augment_code_snippet>

**Issue:**
- ✅ Images are embedded in PDF (that's why you can extract them)
- ❌ Original image files might not be saved separately
- ❌ `invoiceImageUrls` array might contain URLs to non-existent files

---

### **Cause 6: Upload Process Interrupted (MEDIUM)**

**Probability:** 🟡 **40%**

**Explanation:**
The upload process was interrupted before completing, leaving partial data.

**Upload flow:**

<augment_code_snippet path="src/app/api/driver/stops/[id]/upload/route.ts" mode="EXCERPT">
````typescript
// Lines 130-319: Upload process
1. Receive file from driver
2. Save image to public/uploads/
3. Generate PDF with embedded images
4. Save PDF to public/uploads/pdf/
5. Update database with URLs

// Line 309-319: Database update
await prisma.stop.update({
  where: { id: stop.id },
  data: {
    signedInvoicePdfUrl: pdfUrl,
    invoiceImageUrls: imageUrls?.map(img => img.url) || [],
  },
});
````
</augment_code_snippet>

**Possible interruption points:**
1. ❌ Image saved, but PDF generation failed → Database not updated
2. ❌ PDF generated, but database update failed → URLs not saved
3. ❌ Network timeout during upload → Partial file saved
4. ❌ Server crash during upload → Transaction rolled back

---

## 🛠️ **Diagnostic Steps**

### **Step 1: Check Database**

```sql
-- Find the stop in question
SELECT 
  id,
  sequence,
  customerNameFromUpload,
  signedInvoicePdfUrl,
  invoiceImageUrls,
  status,
  completionTime
FROM stops
WHERE 
  customerNameFromUpload LIKE '%WholeSum Foods%'
  AND DATE(completionTime) = '2026-01-14'
  AND driverNameFromUpload = 'Luis';
```

**What to look for:**
- ✅ Is `invoiceImageUrls` array populated?
- ✅ What URLs are stored in the array?
- ✅ Is `signedInvoicePdfUrl` populated?
- ✅ Do the URLs look correct?

---

### **Step 2: Check File System**

```bash
# SSH into the server
cd /path/to/app

# Check if uploads directory exists
ls -la public/uploads/

# Search for files related to this stop
find public/uploads/ -name "*STOP_ID*" -ls

# Check file permissions
ls -la public/uploads/*.jpg

# Check disk space
df -h
```

**What to look for:**
- ✅ Does `public/uploads/` directory exist?
- ✅ Are there any image files for this stop?
- ✅ What are the file permissions? (should be readable by Node.js process)
- ✅ Is there enough disk space?

---

### **Step 3: Test URL Directly**

```bash
# Get the URL from database
# Example: /uploads/invoice_abc123_1705276800000_xyz789_img1.jpg

# Test if file exists
curl -I https://yourdomain.com/uploads/invoice_abc123_1705276800000_xyz789_img1.jpg

# Expected: 200 OK
# If 404: File doesn't exist or server not serving it
```

---

### **Step 4: Check Server Logs**

```bash
# Check PM2 logs
pm2 logs br-driver-app --lines 1000 | grep "invoice"

# Check for upload errors
pm2 logs br-driver-app --lines 1000 | grep "upload"

# Check for file system errors
pm2 logs br-driver-app --lines 1000 | grep "ENOENT"
```

**What to look for:**
- ✅ Upload success/failure messages
- ✅ File system errors (ENOENT, EACCES, etc.)
- ✅ PDF generation errors
- ✅ Database update errors

---

## 🔧 **Solutions by Root Cause**

### **Solution 1: File Path Mismatch**

**If the file exists but URL is wrong:**

```typescript
// Fix the URL in the database
UPDATE stops
SET invoiceImageUrls = ARRAY['/uploads/correct_filename.jpg']
WHERE id = 'STOP_ID';
```

---

### **Solution 2: Missing File**

**If the file is missing:**

**Option A: Extract from PDF**
1. Download the PDF from `signedInvoicePdfUrl`
2. Extract images using a PDF tool
3. Re-upload images to correct location
4. Update database with correct URLs

**Option B: Ask driver to re-upload**
1. Mark stop as needing re-upload
2. Driver uploads images again
3. System generates new PDF

---

### **Solution 3: Server Not Serving Files**

**If server.js is not running or misconfigured:**

```javascript
// Ensure server.js is handling /uploads/ correctly
// Check if PM2 is using server.js:
pm2 describe br-driver-app

// Should show:
// script: server.js (NOT next start)
```

**If using Nginx:**

```nginx
# Add to nginx config
location /uploads/ {
    alias /path/to/app/public/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

### **Solution 4: Database URL Corruption**

**If URLs are malformed:**

```sql
-- Check for common issues
SELECT 
  id,
  invoiceImageUrls,
  CASE
    WHEN invoiceImageUrls::text LIKE '%//%' THEN 'Double slash'
    WHEN invoiceImageUrls::text NOT LIKE '%/%' THEN 'Missing slash'
    WHEN invoiceImageUrls::text LIKE '%\\%' THEN 'Backslash'
    ELSE 'OK'
  END as url_issue
FROM stops
WHERE invoiceImageUrls IS NOT NULL
  AND array_length(invoiceImageUrls, 1) > 0;
```

---

## 🚨 **Immediate Action Plan**

### **For This Specific Stop (WholeSum Foods LLC)**

1. **Extract image from PDF** (already done ✅)
2. **Upload image to correct location:**
   ```bash
   # Copy extracted image to server
   scp extracted_image.jpg server:/path/to/app/public/uploads/invoice_STOPID_manual.jpg
   ```

3. **Update database:**
   ```sql
   UPDATE stops
   SET invoiceImageUrls = ARRAY['/uploads/invoice_STOPID_manual.jpg']
   WHERE id = 'STOP_ID';
   ```

4. **Verify fix:**
   ```bash
   curl -I https://yourdomain.com/uploads/invoice_STOPID_manual.jpg
   # Should return 200 OK
   ```

---

### **For Future Prevention**

1. **Add file existence validation** before saving URLs to database
2. **Add retry logic** for failed uploads
3. **Add backup storage** (S3, Cloudinary, etc.) for images
4. **Add monitoring** for 404 errors on /uploads/ paths
5. **Add automated cleanup** with database sync (don't delete files still referenced in DB)

---

## 📊 **Most Likely Scenario**

Based on the evidence:

1. **Image was uploaded** (it's in the PDF)
2. **PDF was generated successfully** (you have the PDF)
3. **Image file is missing** from `public/uploads/` directory

**Most likely cause:** File was deleted during server maintenance, deployment, or cleanup

**Recommended fix:**
1. Extract image from PDF (done ✅)
2. Upload to server manually
3. Update database with correct URL
4. Implement backup storage for future uploads

---

## 🎯 **Conclusion**

The 404 error is most likely caused by **missing image files** on the server, even though the URLs are stored in the database. The images were successfully embedded in the PDF during upload, but the original image files were either:
- Never saved separately
- Deleted during server maintenance
- Lost during deployment

**Immediate fix:** Extract from PDF and re-upload manually  
**Long-term fix:** Implement cloud storage (S3) for invoice images
