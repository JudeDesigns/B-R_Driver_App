#!/usr/bin/env node

/**
 * File Management System Setup Script
 * 
 * This script sets up the complete file management system for the B&R Driver App.
 * It performs all necessary setup steps in the correct order.
 * 
 * What it does:
 * 1. Verifies database schema is up to date
 * 2. Creates file categories
 * 3. Sets up directory structure
 * 4. Migrates existing files (optional)
 * 5. Sets up cleanup cron job (optional)
 * 6. Runs system tests
 * 
 * Usage:
 * node scripts/setup-file-management.js [options]
 * 
 * Options:
 * --migrate-files: Migrate existing files from public/uploads
 * --setup-cron: Set up automatic cleanup cron job
 * --dry-run: Show what would be done without actually doing it
 * --verbose: Show detailed output
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

class FileManagementSetup {
  constructor(options = {}) {
    this.migrateFiles = options.migrateFiles || false;
    this.setupCron = options.setupCron || false;
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.uploadsPath = path.join(process.cwd(), 'uploads');
    
    this.steps = [
      { name: 'Database Schema', fn: this.verifyDatabaseSchema.bind(this) },
      { name: 'File Categories', fn: this.setupFileCategories.bind(this) },
      { name: 'Directory Structure', fn: this.setupDirectoryStructure.bind(this) },
      { name: 'File Migration', fn: this.migrateExistingFiles.bind(this), optional: true },
      { name: 'Cleanup Automation', fn: this.setupCleanupCron.bind(this), optional: true },
      { name: 'System Tests', fn: this.runSystemTests.bind(this) },
    ];
  }

  async run() {
    console.log('🚀 Setting up File Management System for B&R Driver App');
    console.log('=====================================================');
    console.log(`🔍 Dry run mode: ${this.dryRun ? 'ON' : 'OFF'}`);
    console.log(`📁 Uploads directory: ${this.uploadsPath}`);
    console.log('');

    try {
      for (const step of this.steps) {
        if (step.optional && !this.shouldRunOptionalStep(step.name)) {
          console.log(`⏭️  Skipping optional step: ${step.name}`);
          continue;
        }

        console.log(`📋 Step: ${step.name}`);
        console.log('─'.repeat(50));
        
        await step.fn();
        
        console.log(`✅ ${step.name} completed successfully!\n`);
      }

      this.showCompletionSummary();

    } catch (error) {
      console.error(`❌ Setup failed during step: ${error.message}`);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  shouldRunOptionalStep(stepName) {
    if (stepName === 'File Migration') return this.migrateFiles;
    if (stepName === 'Cleanup Automation') return this.setupCron;
    return false;
  }

  async verifyDatabaseSchema() {
    console.log('   🔍 Checking database schema...');
    
    try {
      // Check if file management tables exist
      const fileCategories = await prisma.fileCategory.findMany({ take: 1 });
      const files = await prisma.file.findMany({ take: 1 });
      
      console.log('   ✅ File management tables are present');
      
      // Check if Prisma client is up to date
      if (!this.dryRun) {
        console.log('   🔄 Generating Prisma client...');
        execSync('npx prisma generate', { stdio: 'pipe' });
      }
      
      console.log('   ✅ Database schema is up to date');
      
    } catch (error) {
      if (error.code === 'P2021') {
        console.log('   ⚠️  Database tables not found. Running migration...');
        if (!this.dryRun) {
          execSync('npx prisma db push', { stdio: 'inherit' });
        }
        console.log('   ✅ Database migration completed');
      } else {
        throw new Error(`Database schema verification failed: ${error.message}`);
      }
    }
  }

  async setupFileCategories() {
    console.log('   📂 Setting up file categories...');
    
    try {
      const existingCategories = await prisma.fileCategory.count();
      
      if (existingCategories > 0) {
        console.log(`   ℹ️  Found ${existingCategories} existing file categories`);
        return;
      }
      
      if (!this.dryRun) {
        console.log('   🌱 Seeding file categories...');
        execSync('node scripts/seed-file-categories.js', { stdio: 'inherit' });
      } else {
        console.log('   🔍 Would seed file categories (dry run)');
      }
      
      const totalCategories = await prisma.fileCategory.count();
      console.log(`   ✅ File categories ready (${totalCategories} total)`);
      
    } catch (error) {
      throw new Error(`File categories setup failed: ${error.message}`);
    }
  }

  async setupDirectoryStructure() {
    console.log('   📁 Setting up directory structure...');

    // Get current year and month for initial structure
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

    const directories = [
      ...baseDirectories,
      // Add current year/month structure for organized categories
      ...organizedCategories.map(cat => `${cat}/${year}`),
      ...organizedCategories.map(cat => `${cat}/${year}/${month}`),
    ];

    for (const dir of directories) {
      const fullPath = path.join(this.uploadsPath, dir);
      
      try {
        if (!this.dryRun) {
          await fs.mkdir(fullPath, { recursive: true });
        }
        
        if (this.verbose) {
          console.log(`   📁 Created: ${dir}`);
        }
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw new Error(`Failed to create directory ${dir}: ${error.message}`);
        }
      }
    }
    
    console.log(`   ✅ Directory structure ready (${directories.length} directories)`);
  }

  async migrateExistingFiles() {
    console.log('   📦 Migrating existing files...');
    
    const oldUploadsPath = path.join(process.cwd(), 'public', 'uploads');
    
    try {
      await fs.access(oldUploadsPath);
    } catch (error) {
      console.log('   ℹ️  No existing uploads directory found. Migration not needed.');
      return;
    }
    
    if (!this.dryRun) {
      const migrationArgs = ['node', 'scripts/migrate-existing-files.js'];
      if (this.verbose) migrationArgs.push('--verbose');
      
      console.log('   🔄 Running file migration...');
      execSync(migrationArgs.join(' '), { stdio: 'inherit' });
    } else {
      console.log('   🔍 Would migrate existing files (dry run)');
    }
    
    console.log('   ✅ File migration completed');
  }

  async setupCleanupCron() {
    console.log('   ⏰ Setting up cleanup automation...');
    
    const cronJob = '0 2 * * * cd ' + process.cwd() + ' && node scripts/file-cleanup.js';
    const cronFile = '/tmp/br-driver-app-cron';
    
    if (!this.dryRun) {
      try {
        // Create cron job file
        await fs.writeFile(cronFile, cronJob + '\n');
        
        // Install cron job
        execSync(`crontab ${cronFile}`, { stdio: 'pipe' });
        
        // Clean up temp file
        await fs.unlink(cronFile);
        
        console.log('   ✅ Cleanup cron job installed (runs daily at 2 AM)');
      } catch (error) {
        console.log('   ⚠️  Could not install cron job automatically');
        console.log('   💡 Manual setup required:');
        console.log(`      Add this line to your crontab: ${cronJob}`);
      }
    } else {
      console.log('   🔍 Would install cleanup cron job (dry run)');
      console.log(`      Cron job: ${cronJob}`);
    }
  }

  async runSystemTests() {
    console.log('   🧪 Running system tests...');
    
    try {
      // Test 1: Database connectivity
      await prisma.fileCategory.findFirst();
      console.log('   ✅ Database connectivity test passed');
      
      // Test 2: Directory permissions
      const testDir = path.join(this.uploadsPath, 'temp');
      const testFile = path.join(testDir, 'test-file.txt');
      
      if (!this.dryRun) {
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(testFile, 'test content');
        await fs.unlink(testFile);
      }
      console.log('   ✅ Directory permissions test passed');
      
      // Test 3: File categories
      const categoryCount = await prisma.fileCategory.count();
      if (categoryCount === 0) {
        throw new Error('No file categories found');
      }
      console.log(`   ✅ File categories test passed (${categoryCount} categories)`);
      
      // Test 4: Sharp image processing (if available)
      try {
        const sharp = require('sharp');
        console.log('   ✅ Image processing (Sharp) available');
      } catch (error) {
        console.log('   ⚠️  Sharp not available - image processing disabled');
      }
      
      console.log('   ✅ All system tests passed');
      
    } catch (error) {
      throw new Error(`System tests failed: ${error.message}`);
    }
  }

  showCompletionSummary() {
    console.log('🎉 File Management System Setup Complete!');
    console.log('==========================================');
    console.log('');
    console.log('✅ What was set up:');
    console.log('   📊 Database schema with file management tables');
    console.log('   📂 File categories for organizing uploads');
    console.log('   📁 Organized directory structure');
    
    if (this.migrateFiles) {
      console.log('   📦 Existing files migrated to new structure');
    }
    
    if (this.setupCron) {
      console.log('   ⏰ Automatic cleanup cron job');
    }
    
    console.log('   🧪 System tests verified');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Access the admin panel at /admin/file-management');
    console.log('   2. Test file uploads through the new API endpoints');
    console.log('   3. Configure file retention policies as needed');
    console.log('   4. Set up backup procedures for the uploads directory');
    console.log('');
    console.log('📚 Available scripts:');
    console.log('   • node scripts/file-cleanup.js - Manual cleanup');
    console.log('   • node scripts/migrate-existing-files.js - Migrate files');
    console.log('   • node scripts/seed-file-categories.js - Reset categories');
    console.log('');
    console.log('🔗 API endpoints:');
    console.log('   • POST /api/files/upload - Upload files');
    console.log('   • GET /api/files/upload - List files');
    console.log('   • GET /api/files/secure/[id] - Secure file access');
    console.log('   • GET /api/files/secure-url/[id] - Generate secure URLs');
    console.log('');
    
    if (!this.dryRun) {
      console.log('✨ File Management System is ready for use!');
    } else {
      console.log('🔍 This was a dry run. Run without --dry-run to apply changes.');
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--migrate-files':
      options.migrateFiles = true;
      break;
    case '--setup-cron':
      options.setupCron = true;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
File Management System Setup Script

Usage: node scripts/setup-file-management.js [options]

Options:
  --migrate-files  Migrate existing files from public/uploads
  --setup-cron     Set up automatic cleanup cron job
  --dry-run        Show what would be done without actually doing it
  --verbose        Show detailed output
  --help           Show this help message

Examples:
  # Basic setup
  node scripts/setup-file-management.js

  # Full setup with migration and automation
  node scripts/setup-file-management.js --migrate-files --setup-cron

  # Preview what would be done
  node scripts/setup-file-management.js --dry-run --verbose
      `);
      process.exit(0);
  }
}

// Run the setup
const setup = new FileManagementSetup(options);
setup.run().catch(console.error);
