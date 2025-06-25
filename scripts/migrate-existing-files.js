#!/usr/bin/env node

/**
 * Migration Script for Existing Files
 * 
 * This script migrates existing files from the old unorganized structure
 * to the new organized file management system.
 * 
 * What it does:
 * 1. Scans the existing public/uploads directory
 * 2. Categorizes files based on naming patterns and types
 * 3. Moves files to the new organized structure
 * 4. Creates file records in the database
 * 5. Generates thumbnails for images
 * 
 * Usage:
 * node scripts/migrate-existing-files.js [options]
 * 
 * Options:
 * --dry-run: Show what would be done without actually doing it
 * --verbose: Show detailed output
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const prisma = new PrismaClient();

class FileMigrationService {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.oldUploadsPath = path.join(process.cwd(), 'public', 'uploads');
    this.newUploadsPath = path.join(process.cwd(), 'uploads');
    
    this.stats = {
      filesProcessed: 0,
      filesMigrated: 0,
      filesSkipped: 0,
      thumbnailsGenerated: 0,
      errors: [],
    };

    // File categorization patterns
    this.categoryPatterns = {
      'delivery-photos': [
        /delivery.*\.(jpg|jpeg|png|gif|webp)$/i,
        /photo.*\.(jpg|jpeg|png|gif|webp)$/i,
        /image.*\.(jpg|jpeg|png|gif|webp)$/i,
      ],
      'safety-checks': [
        /safety.*\.(jpg|jpeg|png|gif|webp|pdf)$/i,
        /check.*\.(jpg|jpeg|png|gif|webp|pdf)$/i,
      ],
      'invoices': [
        /invoice.*\.(pdf|jpg|jpeg|png)$/i,
        /bill.*\.(pdf|jpg|jpeg|png)$/i,
      ],
      'credit-memos': [
        /credit.*\.(pdf|jpg|jpeg|png)$/i,
        /memo.*\.(pdf|jpg|jpeg|png)$/i,
        /refund.*\.(pdf|jpg|jpeg|png)$/i,
      ],
      'delivery-receipts': [
        /receipt.*\.pdf$/i,
        /delivery.*\.pdf$/i,
      ],
      'documents': [
        /\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i,
      ],
    };
  }

  async run() {
    console.log('🚀 Starting file migration process...');
    console.log(`📂 Old uploads path: ${this.oldUploadsPath}`);
    console.log(`📁 New uploads path: ${this.newUploadsPath}`);
    console.log(`🔍 Dry run mode: ${this.dryRun ? 'ON' : 'OFF'}`);
    console.log('');

    try {
      // Check if old uploads directory exists
      try {
        await fs.access(this.oldUploadsPath);
      } catch (error) {
        console.log('ℹ️  No existing uploads directory found. Migration not needed.');
        return;
      }

      // Ensure new uploads directory structure exists
      await this.ensureDirectoryStructure();

      // Get all existing files
      const existingFiles = await this.scanDirectory(this.oldUploadsPath);
      console.log(`📊 Found ${existingFiles.length} files to process`);

      // Process each file
      for (const filePath of existingFiles) {
        await this.processFile(filePath);
      }

      // Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Migration process failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  async ensureDirectoryStructure() {
    const directories = [
      'documents/invoices',
      'documents/credit-memos',
      'documents/statements',
      'documents/other',
      'images/delivery-photos',
      'images/safety-checks',
      'images/thumbnails',
      'pdfs/delivery-receipts',
      'pdfs/reports',
      'temp',
      'archive',
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.newUploadsPath, dir);
      if (!this.dryRun) {
        await fs.mkdir(fullPath, { recursive: true });
      }
      if (this.verbose) {
        console.log(`   📁 Ensured directory: ${dir}`);
      }
    }
  }

  async scanDirectory(dir) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dir}:`, error.message);
    }
    
    return files;
  }

  async processFile(filePath) {
    try {
      this.stats.filesProcessed++;
      
      const fileName = path.basename(filePath);
      const relativePath = path.relative(this.oldUploadsPath, filePath);
      
      if (this.verbose) {
        console.log(`   📄 Processing: ${relativePath}`);
      }

      // Skip if file already exists in new structure
      const existingFile = await prisma.file.findFirst({
        where: { originalName: fileName },
      });

      if (existingFile) {
        if (this.verbose) {
          console.log(`   ⚠️  File already migrated: ${fileName}`);
        }
        this.stats.filesSkipped++;
        return;
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      const fileBuffer = await fs.readFile(filePath);
      
      // Generate checksum
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Determine MIME type
      const mimeType = this.getMimeType(fileName);
      
      // Categorize file
      const category = this.categorizeFile(fileName);
      
      // Generate new file path
      const storedName = this.generateStoredName(fileName, mimeType);
      const newFilePath = this.generateNewFilePath(category, storedName);
      const fullNewPath = path.join(this.newUploadsPath, newFilePath);

      if (!this.dryRun) {
        // Ensure target directory exists
        await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
        
        // Copy file to new location
        await fs.copyFile(filePath, fullNewPath);
        
        // Get file category from database
        const fileCategory = await prisma.fileCategory.findUnique({
          where: { name: category },
        });

        // Create file record
        const fileRecord = await prisma.file.create({
          data: {
            originalName: fileName,
            storedName,
            filePath: newFilePath,
            fileSize: stats.size,
            mimeType,
            categoryId: fileCategory?.id,
            uploadedBy: await this.getSystemUserId(),
            checksum,
            metadata: {
              migratedFrom: relativePath,
              migratedAt: new Date().toISOString(),
            },
          },
        });

        // Generate thumbnails for images
        if (this.isImage(mimeType)) {
          await this.generateThumbnails(fileRecord.id, fullNewPath);
        }
      }

      this.stats.filesMigrated++;
      
      if (this.verbose) {
        console.log(`   ✅ Migrated to: ${newFilePath}`);
      }

    } catch (error) {
      const errorMsg = `Failed to process file ${filePath}: ${error.message}`;
      this.stats.errors.push(errorMsg);
      if (this.verbose) {
        console.error(`   ❌ ${errorMsg}`);
      }
    }
  }

  categorizeFile(fileName) {
    for (const [category, patterns] of Object.entries(this.categoryPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(fileName)) {
          return category;
        }
      }
    }
    
    // Default categorization based on file extension
    const ext = path.extname(fileName).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      return 'delivery-photos';
    } else if (ext === '.pdf') {
      return 'documents';
    } else {
      return 'documents';
    }
  }

  generateNewFilePath(category, fileName) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const categoryPaths = {
      'delivery-photos': path.join('images', 'delivery-photos', year.toString(), month),
      'safety-checks': path.join('images', 'safety-checks', year.toString(), month),
      'invoices': path.join('documents', 'invoices', year.toString(), month),
      'credit-memos': path.join('documents', 'credit-memos', year.toString(), month),
      'delivery-receipts': path.join('pdfs', 'delivery-receipts', year.toString(), month),
      'documents': path.join('documents', 'other', year.toString(), month),
    };
    
    const basePath = categoryPaths[category] || path.join('documents', 'other', year.toString(), month);
    return path.join(basePath, fileName);
  }

  generateStoredName(originalName, mimeType) {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const extension = this.getExtensionFromMimeType(mimeType) || path.extname(originalName);
    const baseName = path.basename(originalName, path.extname(originalName));
    return `${baseName}_${timestamp}_${random}${extension}`;
  }

  getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  getExtensionFromMimeType(mimeType) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    };
    return extensions[mimeType] || '';
  }

  isImage(mimeType) {
    return mimeType.startsWith('image/');
  }

  async generateThumbnails(fileId, imagePath) {
    const thumbnailSizes = [
      { name: 'SMALL', width: 150, height: 150 },
      { name: 'MEDIUM', width: 300, height: 300 },
      { name: 'LARGE', width: 600, height: 600 },
    ];

    for (const size of thumbnailSizes) {
      try {
        const thumbnailName = `thumb_${size.name.toLowerCase()}_${path.basename(imagePath)}`;
        const thumbnailPath = path.join('images', 'thumbnails', thumbnailName);
        const fullThumbnailPath = path.join(this.newUploadsPath, thumbnailPath);

        await fs.mkdir(path.dirname(fullThumbnailPath), { recursive: true });

        const { width, height } = await sharp(imagePath)
          .resize(size.width, size.height, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toFile(fullThumbnailPath);

        await prisma.fileThumbnail.create({
          data: {
            fileId,
            size: size.name,
            filePath: thumbnailPath,
            width,
            height,
          },
        });

        this.stats.thumbnailsGenerated++;
      } catch (error) {
        console.error(`Failed to generate ${size.name} thumbnail:`, error.message);
      }
    }
  }

  async getSystemUserId() {
    // Try to find an admin user, fallback to first user
    let user = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    
    if (!user) {
      user = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
    }
    
    if (!user) {
      user = await prisma.user.findFirst();
    }
    
    return user?.id || 'system';
  }

  generateReport() {
    console.log('\n📊 Migration Report');
    console.log('===================');
    console.log(`📄 Files processed: ${this.stats.filesProcessed}`);
    console.log(`✅ Files migrated: ${this.stats.filesMigrated}`);
    console.log(`⚠️  Files skipped: ${this.stats.filesSkipped}`);
    console.log(`🖼️  Thumbnails generated: ${this.stats.thumbnailsGenerated}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`❌ Errors: ${this.stats.errors.length}`);
      if (this.verbose) {
        console.log('\nError details:');
        this.stats.errors.forEach(error => console.log(`   - ${error}`));
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    if (!this.dryRun) {
      console.log('\n💡 Next steps:');
      console.log('   1. Verify migrated files in the new structure');
      console.log('   2. Test file access through the admin interface');
      console.log('   3. Consider backing up the old uploads directory');
      console.log('   4. Remove old uploads directory when satisfied');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
File Migration Script for B&R Driver App

Usage: node scripts/migrate-existing-files.js [options]

Options:
  --dry-run    Show what would be done without actually doing it
  --verbose    Show detailed output
  --help       Show this help message
      `);
      process.exit(0);
  }
}

// Run the migration
const migration = new FileMigrationService(options);
migration.run().catch(console.error);
