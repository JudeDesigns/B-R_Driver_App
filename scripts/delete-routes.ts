import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteRouteData() {
  try {
    console.log('Starting deletion of route data...');

    // First, delete all stops (due to foreign key constraints)
    const deletedStops = await prisma.stop.deleteMany({});
    console.log(`Deleted ${deletedStops.count} stops.`);

    // Delete all safety checks
    const deletedSafetyChecks = await prisma.safetyCheck.deleteMany({});
    console.log(`Deleted ${deletedSafetyChecks.count} safety checks.`);

    // Delete all routes
    const deletedRoutes = await prisma.route.deleteMany({});
    console.log(`Deleted ${deletedRoutes.count} routes.`);

    // Delete all route uploads
    const deletedRouteUploads = await prisma.routeUpload.deleteMany({});
    console.log(`Deleted ${deletedRouteUploads.count} route uploads.`);

    console.log('Route data deletion completed successfully.');
  } catch (error) {
    console.error('Error deleting route data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteRouteData();
