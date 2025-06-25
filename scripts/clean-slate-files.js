#!/usr/bin/env node

/**
 * Clean Slate File Management Script
 * 
 * This script safely removes all existing files and gives you a fresh start
 * with the new file management system.
 * 
 * What it does:
 * 1. Backs up existing files (optional)
 * 2. Clears all file records from database
 * 3. Removes all files from uploads directories
 * 4. Recreates clean directory structure
 * 5. Resets file management system to pristine state
 * 
 * Usage:
 * node scripts/clean-slate-files.js [options]
 * 
 * Options:
 * --backup: Create backup before deletion
 * --dry-run: Show what would be done without actually doing it
 * --verbose: Show detailed output
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

class CleanSlateService {
  constructor(options = {}) {
    this.createBackup = options.backup || false;
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.uploadsPath = path.join(process.cwd(), 'uploads');
    this.publicUploadsPath = path.join(process.cwd(), 'public', 'uploads');
    this.backupPath = path.join(process.cwd(), 'backup-uploads-' + Date.now());
    
    this.stats = {
      filesDeleted: 0,
      directoriesDeleted: 0,
      databaseRecordsDeleted: 0,
      backupCreated: false,
    };
  }

  async run() {
    console.log('🧹 Clean Slate File Management');
    console.log('==============================');
    console.log(`🔍 Dry run mode: ${this.dryRun ? 'ON' : 'OFF'}`);
    console.log(`💾 Create backup: ${this.createBackup ? 'YES' : 'NO'}`);
    console.log('');

    try {
      // Step 1: Create backup if requested
      if (this.createBackup) {
        await this.createBackupFiles();
      }

      // Step 2: Clear database records
      await this.clearDatabaseRecords();

      // Step 3: Remove all files
      await this.removeAllFiles();

      // Step 4: Recreate clean structure
      await this.recreateDirectoryStructure();

      // Step 5: Generate report
      this.generateReport();

    } catch (error) {
      console.error('❌ Clean slate process failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  async createBackupFiles() {
    console.log('💾 Creating backup of existing files...');
    
    const directoriesToBackup = [this.uploadsPath, this.publicUploadsPath];
    
    for (const sourceDir of directoriesToBackup) {
      try {
        await fs.access(sourceDir);
        
        const dirName = path.basename(sourceDir);
        const backupDir = path.join(this.backupPath, dirName);
        
        if (!this.dryRun) {
          await this.copyDirectory(sourceDir, backupDir);
        }
        
        if (this.verbose) {
          console.log(`   💾 Backed up: ${sourceDir} -> ${backupDir}`);
        }
        
        this.stats.backupCreated = true;
        
      } catch (error) {
        if (this.verbose) {
          console.log(`   ⚠️  Directory not found: ${sourceDir}`);
        }
      }
    }
    
    if (this.stats.backupCreated) {
      console.log(`   ✅ Backup created at: ${this.backupPath}`);
    } else {
      console.log('   ℹ️  No files to backup');
    }
  }

  async copyDirectory(source, destination) {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  async clearDatabaseRecords() {
    console.log('🗄️  Clearing database records...');
    
    try {
      // Count existing records
      const fileCount = await prisma.file.count();
      const thumbnailCount = await prisma.fileThumbnail.count();
      const versionCount = await prisma.fileVersion.count();
      
      console.log(`   📊 Found ${fileCount} files, ${thumbnailCount} thumbnails, ${versionCount} versions`);
      
      if (!this.dryRun) {
        // Delete in correct order (foreign key constraints)
        await prisma.fileThumbnail.deleteMany();
        await prisma.fileVersion.deleteMany();
        await prisma.file.deleteMany();
      }
      
      this.stats.databaseRecordsDeleted = fileCount + thumbnailCount + versionCount;
      console.log(`   ✅ Database records cleared`);
      
    } catch (error) {
      throw new Error(`Failed to clear database records: ${error.message}`);
    }
  }

  async removeAllFiles() {
    console.log('🗑️  Removing all files...');
    
    const directoriesToClean = [this.uploadsPath, this.publicUploadsPath];
    
    for (const dir of directoriesToClean) {
      try {
        await fs.access(dir);
        
        if (!this.dryRun) {
          await this.removeDirectory(dir);
        }
        
        const dirName = path.basename(dir);
        console.log(`   🗑️  Removed: ${dirName}/`);
        this.stats.directoriesDeleted++;
        
      } catch (error) {
        if (this.verbose) {
          console.log(`   ℹ️  Directory not found: ${dir}`);
        }
      }
    }
    
    console.log(`   ✅ All files removed`);
  }

  async removeDirectory(dirPath) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.removeDirectory(fullPath);
        } else {
          await fs.unlink(fullPath);
          this.stats.filesDeleted++;
        }
      }
      
      await fs.rmdir(dirPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async recreateDirectoryStructure() {
    console.log('📁 Recreating clean directory structure...');
    
    // Get current year and month
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const baseDirectories = [
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

    // Create year/month subdirectories for organized categories
    const organizedCategories = [
      'documents/invoices',
      'documents/credit-memos',
      'documents/statements',
      'documents/other',
      'images/delivery-photos',
      'images/safety-checks',
      'pdfs/delivery-receipts',
      'pdfs/reports',
    ];

    const allDirectories = [
      ...baseDirectories,
      // Add current year/month structure
      ...organizedCategories.map(cat => `${cat}/${year}`),
      ...organizedCategories.map(cat => `${cat}/${year}/${month}`),
    ];

    for (const dir of allDirectories) {
      const fullPath = path.join(this.uploadsPath, dir);
      
      if (!this.dryRun) {
        await fs.mkdir(fullPath, { recursive: true });
      }
      
      if (this.verbose) {
        console.log(`   📁 Created: ${dir}`);
      }
    }
    
    console.log(`   ✅ Clean directory structure created (${allDirectories.length} directories)`);
  }

  generateReport() {
    console.log('\n📊 Clean Slate Report');
    console.log('=====================');
    console.log(`🗑️  Files deleted: ${this.stats.filesDeleted}`);
    console.log(`📁 Directories removed: ${this.stats.directoriesDeleted}`);
    console.log(`🗄️  Database records deleted: ${this.stats.databaseRecordsDeleted}`);
    
    if (this.stats.backupCreated) {
      console.log(`💾 Backup created: ${this.backupPath}`);
    }
    
    console.log('\n✅ Clean slate completed successfully!');
    console.log('\n🎯 What you have now:');
    console.log('   📁 Clean, organized directory structure');
    console.log('   🗄️  Empty database ready for new files');
    console.log('   🔧 File management system ready to use');
    
    if (this.stats.backupCreated) {
      console.log('\n💡 Your old files are safely backed up at:');
      console.log(`   ${this.backupPath}`);
    }
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Access /admin/file-management to see the clean interface');
    console.log('   2. Upload files through the proper channels (driver app, admin uploads)');
    console.log('   3. Files will be automatically organized and tracked');
    
    if (!this.dryRun) {
      console.log('\n✨ Your file management system is now clean and ready!');
    } else {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--backup':
      options.backup = true;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
Clean Slate File Management Script

Usage: node scripts/clean-slate-files.js [options]

Options:
  --backup     Create backup of existing files before deletion
  --dry-run    Show what would be done without actually doing it
  --verbose    Show detailed output
  --help       Show this help message

Examples:
  # Preview what would be deleted
  node scripts/clean-slate-files.js --dry-run --verbose

  # Clean slate with backup
  node scripts/clean-slate-files.js --backup

  # Clean slate without backup (permanent deletion)
  node scripts/clean-slate-files.js
      `);
      process.exit(0);
  }
}

// Run the clean slate
const cleanSlate = new CleanSlateService(options);
cleanSlate.run().catch(console.error);
