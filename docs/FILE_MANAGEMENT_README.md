# 📁 File Management System - B&R Driver App

## 🎯 Overview

The File Management System provides comprehensive file organization, security, and automation for the B&R Driver App. It replaces the previous unorganized file storage with a structured, secure, and efficient system.

## ✨ Features

### 🗂️ **Organized File Structure**
- **Automatic categorization** by file type and purpose
- **Date-based organization** (year/month folders)
- **Dedicated directories** for different file types
- **Archive system** for old files

### 🔐 **Enhanced Security**
- **Token-based file access** with expiration
- **Files outside public directory** for security
- **Access logging** and download tracking
- **MIME type validation** and content checking

### 🖼️ **Image Processing**
- **Automatic thumbnail generation** (small, medium, large)
- **Image compression** with quality control
- **Multiple format support** (JPEG, PNG, GIF, WebP)
- **Progressive JPEG** for web optimization

### 🧹 **Automated Maintenance**
- **Duplicate detection** via SHA256 checksums
- **Automatic archival** of old files
- **Cleanup of temporary files**
- **Storage usage monitoring**

### 📊 **Admin Dashboard**
- **Visual file browser** with search and filters
- **Bulk operations** (archive, delete, move)
- **Storage usage reports**
- **File access analytics**

## 📂 Directory Structure

```
uploads/
├── documents/           # Administrative documents
│   ├── invoices/       # Customer invoices
│   ├── credit-memos/   # Credit memos
│   ├── statements/     # Delivery statements
│   └── other/          # Other document types
├── images/             # Driver-uploaded images
│   ├── delivery-photos/
│   │   ├── 2025/01/    # Organized by year/month
│   │   └── 2025/02/
│   ├── thumbnails/     # Auto-generated thumbnails
│   └── safety-checks/  # Safety check photos
├── pdfs/               # Generated PDFs
│   ├── delivery-receipts/
│   └── reports/        # System reports
├── temp/               # Temporary uploads (auto-cleanup)
└── archive/            # Archived files (older than 1 year)
```

## 🚀 Quick Start

### 1. **Complete Setup**
```bash
# Run the comprehensive setup script
node scripts/setup-file-management.js --migrate-files --setup-cron

# Or preview what would be done
node scripts/setup-file-management.js --dry-run --verbose
```

### 2. **Manual Setup Steps**
```bash
# 1. Update database schema
npx prisma db push

# 2. Create file categories
node scripts/seed-file-categories.js

# 3. Create directory structure
mkdir -p uploads/{documents/{invoices,credit-memos,statements,other},images/{delivery-photos,safety-checks,thumbnails},pdfs/{delivery-receipts,reports},temp,archive}

# 4. Migrate existing files (optional)
node scripts/migrate-existing-files.js

# 5. Set up cleanup automation (optional)
node scripts/file-cleanup.js --help
```

## 📋 File Categories

| Category | Description | Max Size | Retention | Allowed Types |
|----------|-------------|----------|-----------|---------------|
| **delivery-photos** | Driver delivery photos | 10MB | 1 year | Images |
| **safety-checks** | Safety check documents | 10MB | 3 years | Images, PDFs |
| **documents** | Administrative files | 50MB | 7 years | Office docs |
| **invoices** | Customer invoices | 20MB | 7 years | PDFs, Images |
| **credit-memos** | Credit memos | 20MB | 7 years | PDFs, Images |
| **statements** | Delivery statements | 20MB | 3 years | PDFs |
| **pdfs** | Generated PDFs | 20MB | 3 years | PDFs |
| **reports** | System reports | 50MB | 2 years | PDFs, CSV, Excel |

## 🔌 API Endpoints

### **Upload Files**
```http
POST /api/files/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
- file: File to upload
- category: File category (required)
- subCategory: Optional subcategory
- generateThumbnails: true/false
- compress: true/false
- quality: 1-100 (for compression)
- metadata: JSON string with additional data
```

### **List Files**
```http
GET /api/files/upload?category=delivery-photos&limit=50&offset=0
Authorization: Bearer <token>
```

### **Secure File Access**
```http
GET /api/files/secure/[fileId]?token=<secure-token>
```

### **Generate Secure URL**
```http
GET /api/files/secure-url/[fileId]
Authorization: Bearer <token>
```

## 🛠️ Available Scripts

### **Setup & Migration**
```bash
# Complete system setup
node scripts/setup-file-management.js [options]

# Migrate existing files
node scripts/migrate-existing-files.js [options]

# Seed file categories
node scripts/seed-file-categories.js
```

### **Maintenance**
```bash
# Manual cleanup
node scripts/file-cleanup.js [options]

# Archive old files
node scripts/file-cleanup.js --archive-days 365

# Cleanup temp files only
node scripts/file-cleanup.js --category temp
```

### **Script Options**
- `--dry-run` - Preview without making changes
- `--verbose` - Detailed output
- `--help` - Show help information

## 🔧 Configuration

### **File Categories**
Modify categories in `scripts/seed-file-categories.js`:
```javascript
{
  name: 'custom-category',
  description: 'Custom file category',
  pathPrefix: 'custom',
  maxFileSize: 10485760, // 10MB
  allowedTypes: ['image/jpeg', 'application/pdf'],
  retentionDays: 365,
}
```

### **Cleanup Automation**
Set up automatic cleanup with cron:
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/app && node scripts/file-cleanup.js
```

### **Environment Variables**
```env
# JWT secret for secure file tokens
JWT_SECRET=your-secret-key

# Database connection
DATABASE_URL=postgresql://...
```

## 📊 Admin Interface

Access the file management dashboard at:
```
https://your-app.com/admin/file-management
```

### **Features:**
- **File browser** with category filters
- **Search functionality** by name, type, date
- **Bulk operations** (delete, archive, move)
- **Storage usage charts**
- **File access logs**
- **Thumbnail previews** for images

## 🔍 Monitoring & Analytics

### **Storage Usage**
```bash
# Check storage usage by category
node scripts/file-cleanup.js --report-only
```

### **File Access Logs**
File access is automatically logged in the database for security auditing.

### **Health Checks**
```bash
# Verify system health
node scripts/setup-file-management.js --dry-run
```

## 🚨 Troubleshooting

### **Common Issues**

#### **Files not uploading**
1. Check directory permissions: `chmod 755 uploads/`
2. Verify file size limits in categories
3. Check MIME type restrictions

#### **Thumbnails not generating**
1. Ensure Sharp is installed: `npm install sharp`
2. Check image file format support
3. Verify directory write permissions

#### **Secure URLs not working**
1. Check JWT_SECRET environment variable
2. Verify token expiration settings
3. Check file permissions

#### **Migration issues**
1. Run with `--dry-run` first to preview
2. Check source directory permissions
3. Verify database connectivity

### **Debug Mode**
Run any script with `--verbose` for detailed logging:
```bash
node scripts/file-cleanup.js --verbose
```

## 🔄 Backup & Recovery

### **Backup Strategy**
1. **Database backup** - Include file records and metadata
2. **Files backup** - Backup entire `uploads/` directory
3. **Configuration backup** - Backup file categories and settings

### **Recovery Process**
1. Restore database from backup
2. Restore files to `uploads/` directory
3. Run system verification: `node scripts/setup-file-management.js --dry-run`

## 📈 Performance Optimization

### **Image Optimization**
- Automatic compression reduces file sizes by 60-80%
- Progressive JPEG for faster web loading
- Multiple thumbnail sizes for different use cases

### **Storage Optimization**
- Duplicate detection prevents redundant storage
- Automatic archival of old files
- Cleanup of temporary files

### **Access Optimization**
- Secure token-based access with caching
- CDN-ready file structure
- Optimized database queries

## 🎯 Best Practices

1. **Regular cleanup** - Run cleanup script weekly
2. **Monitor storage** - Check usage monthly
3. **Backup regularly** - Daily database, weekly files
4. **Update categories** - Review retention policies quarterly
5. **Security audit** - Review access logs monthly

## 📞 Support

For issues or questions:
1. Check this documentation
2. Run diagnostic scripts with `--verbose`
3. Review application logs
4. Contact system administrator

---

**File Management System v1.0** - Implemented for B&R Driver App
*Comprehensive file organization, security, and automation*
