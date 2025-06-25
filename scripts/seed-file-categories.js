#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const fileCategories = [
  {
    name: 'delivery-photos',
    description: 'Photos taken by drivers during deliveries',
    pathPrefix: 'images/delivery-photos',
    maxFileSize: 10485760, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    retentionDays: 365,
  },
  {
    name: 'safety-checks',
    description: 'Safety check photos and documents',
    pathPrefix: 'images/safety-checks',
    maxFileSize: 10485760, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    retentionDays: 1095, // 3 years
  },
  {
    name: 'documents',
    description: 'Administrative documents and files',
    pathPrefix: 'documents',
    maxFileSize: 52428800, // 50MB
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ],
    retentionDays: 2555, // 7 years
  },
  {
    name: 'invoices',
    description: 'Customer invoices and billing documents',
    pathPrefix: 'documents/invoices',
    maxFileSize: 20971520, // 20MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    retentionDays: 2555, // 7 years
  },
  {
    name: 'credit-memos',
    description: 'Credit memos and refund documents',
    pathPrefix: 'documents/credit-memos',
    maxFileSize: 20971520, // 20MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    retentionDays: 2555, // 7 years
  },
  {
    name: 'statements',
    description: 'Delivery statements and receipts',
    pathPrefix: 'documents/statements',
    maxFileSize: 20971520, // 20MB
    allowedTypes: ['application/pdf'],
    retentionDays: 1095, // 3 years
  },
  {
    name: 'pdfs',
    description: 'Generated PDF documents',
    pathPrefix: 'pdfs',
    maxFileSize: 20971520, // 20MB
    allowedTypes: ['application/pdf'],
    retentionDays: 1095, // 3 years
  },
  {
    name: 'delivery-receipts',
    description: 'Generated delivery receipt PDFs',
    pathPrefix: 'pdfs/delivery-receipts',
    maxFileSize: 20971520, // 20MB
    allowedTypes: ['application/pdf'],
    retentionDays: 1095, // 3 years
  },
  {
    name: 'reports',
    description: 'System generated reports',
    pathPrefix: 'pdfs/reports',
    maxFileSize: 52428800, // 50MB
    allowedTypes: ['application/pdf', 'text/csv', 'application/vnd.ms-excel'],
    retentionDays: 730, // 2 years
  },
];

async function seedFileCategories() {
  console.log('🌱 Seeding file categories...');

  try {
    for (const category of fileCategories) {
      const existingCategory = await prisma.fileCategory.findUnique({
        where: { name: category.name },
      });

      if (existingCategory) {
        console.log(`   ⚠️  Category "${category.name}" already exists, skipping...`);
        continue;
      }

      const createdCategory = await prisma.fileCategory.create({
        data: category,
      });

      console.log(`   ✅ Created category: ${createdCategory.name}`);
    }

    console.log('\n🎉 File categories seeded successfully!');
    
    // Display summary
    const totalCategories = await prisma.fileCategory.count();
    console.log(`📊 Total file categories: ${totalCategories}`);

  } catch (error) {
    console.error('❌ Error seeding file categories:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
seedFileCategories();
