#!/usr/bin/env node

/**
 * File Cleanup Script for B&R Driver App
 * 
 * This script performs the following cleanup tasks:
 * 1. Archives old files (older than specified retention period)
 * 2. Cleans up temporary files (older than 24 hours)
 * 3. Removes orphaned files (files on disk without database records)
 * 4. Generates storage usage reports
 * 
 * Usage:
 * node scripts/file-cleanup.js [options]
 * 
 * Options:
 * --dry-run: Show what would be done without actually doing it
 * --archive-days: Number of days after which to archive files (default: 365)
 * --category: Specific category to clean up (optional)
 * --verbose: Show detailed output
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

class FileCleanupService {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.archiveDays = options.archiveDays || 365;
    this.category = options.category || null;
    this.verbose = options.verbose || false;
    this.uploadsPath = path.join(process.cwd(), 'uploads');
    
    this.stats = {
      filesArchived: 0,
      tempFilesDeleted: 0,
      orphanedFilesDeleted: 0,
      bytesFreed: 0,
      errors: [],
    };
  }

  async run() {
    console.log('🧹 Starting file cleanup process...');
    console.log(`📅 Archive threshold: ${this.archiveDays} days`);
    console.log(`🔍 Dry run mode: ${this.dryRun ? 'ON' : 'OFF'}`);
    
    if (this.category) {
      console.log(`📂 Category filter: ${this.category}`);
    }
    
    console.log('');

    try {
      // Step 1: Archive old files
      await this.archiveOldFiles();
      
      // Step 2: Clean up temporary files
      await this.cleanupTempFiles();
      
      // Step 3: Remove orphaned files
      await this.removeOrphanedFiles();
      
      // Step 4: Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Cleanup process failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  async archiveOldFiles() {
    console.log('📦 Archiving old files...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.archiveDays);
    
    const whereClause = {
      createdAt: { lt: cutoffDate },
      isArchived: false,
      isDeleted: false,
    };
    
    if (this.category) {
      whereClause.category = { name: this.category };
    }
    
    const oldFiles = await prisma.file.findMany({
      where: whereClause,
      include: { category: true },
    });
    
    console.log(`   Found ${oldFiles.length} files to archive`);
    
    for (const file of oldFiles) {
      try {
        const currentPath = path.join(this.uploadsPath, file.filePath);
        const archivePath = path.join(this.uploadsPath, 'archive', file.filePath);
        
        if (this.verbose) {
          console.log(`   📦 Archiving: ${file.originalName}`);
        }
        
        if (!this.dryRun) {
          // Ensure archive directory exists
          await fs.mkdir(path.dirname(archivePath), { recursive: true });
          
          // Move file to archive
          await fs.rename(currentPath, archivePath);
          
          // Update database record
          await prisma.file.update({
            where: { id: file.id },
            data: {
              isArchived: true,
              archivedAt: new Date(),
              filePath: path.join('archive', file.filePath),
            },
          });
        }
        
        this.stats.filesArchived++;
        this.stats.bytesFreed += file.fileSize;
        
      } catch (error) {
        const errorMsg = `Failed to archive file ${file.id}: ${error.message}`;
        this.stats.errors.push(errorMsg);
        if (this.verbose) {
          console.error(`   ❌ ${errorMsg}`);
        }
      }
    }
    
    console.log(`   ✅ Archived ${this.stats.filesArchived} files`);
  }

  async cleanupTempFiles() {
    console.log('🗑️  Cleaning up temporary files...');
    
    const tempDir = path.join(this.uploadsPath, 'temp');
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    try {
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        try {
          const filePath = path.join(tempDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            if (this.verbose) {
              console.log(`   🗑️  Deleting temp file: ${file}`);
            }
            
            if (!this.dryRun) {
              await fs.unlink(filePath);
            }
            
            this.stats.tempFilesDeleted++;
            this.stats.bytesFreed += stats.size;
          }
        } catch (error) {
          const errorMsg = `Failed to delete temp file ${file}: ${error.message}`;
          this.stats.errors.push(errorMsg);
          if (this.verbose) {
            console.error(`   ❌ ${errorMsg}`);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        const errorMsg = `Failed to access temp directory: ${error.message}`;
        this.stats.errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }
    
    console.log(`   ✅ Deleted ${this.stats.tempFilesDeleted} temporary files`);
  }

  async removeOrphanedFiles() {
    console.log('🔍 Removing orphaned files...');
    
    // Get all file records from database
    const dbFiles = await prisma.file.findMany({
      where: { isDeleted: false },
      select: { filePath: true },
    });
    
    const dbFilePaths = new Set(dbFiles.map(f => f.filePath));
    
    // Scan uploads directory for actual files
    const actualFiles = await this.scanDirectory(this.uploadsPath);
    
    for (const actualFile of actualFiles) {
      const relativePath = path.relative(this.uploadsPath, actualFile);
      
      // Skip archive and temp directories
      if (relativePath.startsWith('archive') || relativePath.startsWith('temp')) {
        continue;
      }
      
      if (!dbFilePaths.has(relativePath)) {
        try {
          if (this.verbose) {
            console.log(`   🗑️  Deleting orphaned file: ${relativePath}`);
          }
          
          if (!this.dryRun) {
            const stats = await fs.stat(actualFile);
            await fs.unlink(actualFile);
            this.stats.bytesFreed += stats.size;
          }
          
          this.stats.orphanedFilesDeleted++;
          
        } catch (error) {
          const errorMsg = `Failed to delete orphaned file ${relativePath}: ${error.message}`;
          this.stats.errors.push(errorMsg);
          if (this.verbose) {
            console.error(`   ❌ ${errorMsg}`);
          }
        }
      }
    }
    
    console.log(`   ✅ Deleted ${this.stats.orphanedFilesDeleted} orphaned files`);
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
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  generateReport() {
    console.log('\n📊 Cleanup Report');
    console.log('==================');
    console.log(`📦 Files archived: ${this.stats.filesArchived}`);
    console.log(`🗑️  Temp files deleted: ${this.stats.tempFilesDeleted}`);
    console.log(`🔍 Orphaned files deleted: ${this.stats.orphanedFilesDeleted}`);
    console.log(`💾 Space freed: ${this.formatBytes(this.stats.bytesFreed)}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`❌ Errors: ${this.stats.errors.length}`);
      if (this.verbose) {
        console.log('\nError details:');
        this.stats.errors.forEach(error => console.log(`   - ${error}`));
      }
    }
    
    console.log('\n✅ Cleanup completed successfully!');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    case '--archive-days':
      options.archiveDays = parseInt(args[++i]);
      break;
    case '--category':
      options.category = args[++i];
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
File Cleanup Script for B&R Driver App

Usage: node scripts/file-cleanup.js [options]

Options:
  --dry-run         Show what would be done without actually doing it
  --archive-days N  Number of days after which to archive files (default: 365)
  --category NAME   Specific category to clean up (optional)
  --verbose         Show detailed output
  --help           Show this help message
      `);
      process.exit(0);
  }
}

// Run the cleanup
const cleanup = new FileCleanupService(options);
cleanup.run().catch(console.error);
