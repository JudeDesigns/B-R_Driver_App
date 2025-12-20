/**
 * Location History Cleanup Script
 * 
 * Automatically deletes location history older than configured retention period
 * Run this as a cron job (e.g., daily at 2 AM)
 * 
 * Usage:
 * - Manual: npx ts-node src/scripts/cleanupLocationHistory.ts
 * - Cron: 0 2 * * * cd /path/to/app && npx ts-node src/scripts/cleanupLocationHistory.ts
 */

import prisma from '../lib/db';

async function cleanupLocationHistory() {
  try {
    console.log('Starting location history cleanup...');

    // Get retention period from environment (default: 7 days)
    const retentionDays = parseInt(
      process.env.LOCATION_HISTORY_RETENTION_DAYS || '7',
      10
    );

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`Deleting location records older than ${cutoffDate.toISOString()}`);

    // Delete old location records
    const result = await prisma.driverLocation.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`✅ Cleanup complete! Deleted ${result.count} location records.`);
    console.log(`Retention period: ${retentionDays} days`);

    return result.count;
  } catch (error) {
    console.error('❌ Error during location history cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  cleanupLocationHistory()
    .then((count) => {
      console.log(`Script completed successfully. Deleted ${count} records.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export default cleanupLocationHistory;

