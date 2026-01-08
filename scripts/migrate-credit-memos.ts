/**
 * Migration script to move existing credit memo data from Stop fields to CreditMemo records
 * This script:
 * 1. Finds all stops with creditMemoNumber or creditMemoAmount
 * 2. Creates CreditMemo records for each
 * 3. Keeps the original Stop fields intact (for backward compatibility)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateCreditMemos() {
  console.log('🚀 Starting credit memo migration...\n');

  try {
    // Find all stops with credit memo data
    const stopsWithCreditMemos = await prisma.stop.findMany({
      where: {
        OR: [
          { creditMemoNumber: { not: null } },
          { creditMemoAmount: { not: null } }
        ],
        isDeleted: false
      },
      select: {
        id: true,
        creditMemoNumber: true,
        creditMemoAmount: true,
        orderNumberWeb: true,
        customerNameFromUpload: true
      }
    });

    console.log(`📊 Found ${stopsWithCreditMemos.length} stops with credit memo data\n`);

    if (stopsWithCreditMemos.length === 0) {
      console.log('✅ No credit memos to migrate. Done!');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const stop of stopsWithCreditMemos) {
      // Check if CreditMemo already exists for this stop
      const existingCreditMemo = await prisma.creditMemo.findFirst({
        where: {
          stopId: stop.id,
          creditMemoNumber: stop.creditMemoNumber || '',
          isDeleted: false
        }
      });

      if (existingCreditMemo) {
        console.log(`⏭️  Skipping stop ${stop.id} - CreditMemo already exists`);
        skippedCount++;
        continue;
      }

      // Create CreditMemo record
      if (stop.creditMemoNumber || stop.creditMemoAmount) {
        await prisma.creditMemo.create({
          data: {
            stopId: stop.id,
            creditMemoNumber: stop.creditMemoNumber || 'MIGRATED',
            creditMemoAmount: stop.creditMemoAmount || 0,
            documentId: null, // No document link for migrated data
          }
        });

        console.log(`✅ Migrated: Stop ${stop.id} (${stop.customerNameFromUpload || 'Unknown'}) - ${stop.creditMemoNumber || 'N/A'} - $${stop.creditMemoAmount || 0}`);
        migratedCount++;
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Migrated: ${migratedCount} credit memos`);
    console.log(`   ⏭️  Skipped: ${skippedCount} (already exist)`);
    console.log(`   📊 Total processed: ${stopsWithCreditMemos.length}`);
    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateCreditMemos()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

