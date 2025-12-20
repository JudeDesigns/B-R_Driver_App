/**
 * Location Tracking Database Test
 * Verifies database schema and creates test data
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabaseSchema() {
  console.log('🔍 Testing Database Schema...\n');
  
  try {
    // Test 1: Check if DriverLocation model exists
    console.log('📝 Test 1: DriverLocation Model');
    try {
      const count = await prisma.driverLocation.count();
      console.log(`✅ DriverLocation model exists (${count} records)`);
    } catch (error) {
      console.log('❌ DriverLocation model not found:', error.message);
      return false;
    }
    
    // Test 2: Check User model has location fields
    console.log('\n📝 Test 2: User Location Fields');
    try {
      const user = await prisma.user.findFirst({
        select: {
          id: true,
          username: true,
          lastKnownLatitude: true,
          lastKnownLongitude: true,
          lastLocationUpdate: true,
          locationAccuracy: true
        }
      });
      console.log('✅ User model has location fields');
      if (user) {
        console.log(`   Sample user: ${user.username}`);
        console.log(`   Location: ${user.lastKnownLatitude || 'null'}, ${user.lastKnownLongitude || 'null'}`);
      }
    } catch (error) {
      console.log('❌ User location fields not found:', error.message);
      return false;
    }
    
    // Test 3: Check existing users
    console.log('\n📝 Test 3: Existing Users');
    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true
      }
    });
    console.log(`✅ Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.username} (${user.fullName || 'N/A'}) - ${user.role}`);
    });
    
    // Test 4: Check existing routes
    console.log('\n📝 Test 4: Existing Routes');
    const routes = await prisma.route.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        routeNumber: true,
        date: true,
        status: true,
        driver: {
          select: {
            username: true,
            fullName: true
          }
        }
      },
      take: 5
    });
    console.log(`✅ Found ${routes.length} routes (showing first 5):`);
    routes.forEach(route => {
      console.log(`   - Route ${route.routeNumber || 'N/A'} (${route.status}) - Driver: ${route.driver?.username || 'Unassigned'}`);
    });
    
    // Test 5: Create test location data
    console.log('\n📝 Test 5: Create Test Location Data');
    const driver = users.find(u => u.role === 'DRIVER');
    if (driver && routes.length > 0) {
      const route = routes[0];
      
      // Get a stop from the route
      const stop = await prisma.stop.findFirst({
        where: { routeId: route.id, isDeleted: false }
      });
      
      if (stop) {
        // Create location record
        const location = await prisma.driverLocation.create({
          data: {
            driverId: driver.id,
            routeId: route.id,
            stopId: stop.id,
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 10,
            timestamp: new Date()
          }
        });
        
        // Update user's last known location
        await prisma.user.update({
          where: { id: driver.id },
          data: {
            lastKnownLatitude: 37.7749,
            lastKnownLongitude: -122.4194,
            lastLocationUpdate: new Date(),
            locationAccuracy: 10
          }
        });
        
        console.log('✅ Created test location data');
        console.log(`   Driver: ${driver.username}`);
        console.log(`   Route: ${route.routeNumber || 'N/A'}`);
        console.log(`   Stop: ${stop.id}`);
        console.log(`   Location: 37.7749, -122.4194`);
      } else {
        console.log('⚠️  No stops found for route');
      }
    } else {
      console.log('⚠️  No driver or routes found');
    }
    
    // Test 6: Query location data
    console.log('\n📝 Test 6: Query Location Data');
    const driversWithLocation = await prisma.user.findMany({
      where: {
        role: 'DRIVER',
        isDeleted: false,
        lastKnownLatitude: { not: null },
        lastKnownLongitude: { not: null }
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        lastKnownLatitude: true,
        lastKnownLongitude: true,
        lastLocationUpdate: true,
        locationAccuracy: true
      }
    });
    
    console.log(`✅ Found ${driversWithLocation.length} drivers with location data:`);
    driversWithLocation.forEach(driver => {
      console.log(`   - ${driver.fullName || driver.username}`);
      console.log(`     Location: ${driver.lastKnownLatitude}, ${driver.lastKnownLongitude}`);
      console.log(`     Accuracy: ±${driver.locationAccuracy}m`);
      console.log(`     Updated: ${driver.lastLocationUpdate}`);
    });
    
    // Test 7: Query location history
    console.log('\n📝 Test 7: Query Location History');
    const locationHistory = await prisma.driverLocation.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: {
        driver: {
          select: {
            username: true,
            fullName: true
          }
        }
      }
    });
    
    console.log(`✅ Found ${locationHistory.length} location records (showing last 5):`);
    locationHistory.forEach(loc => {
      console.log(`   - ${loc.driver.fullName || loc.driver.username}`);
      console.log(`     Location: ${loc.latitude}, ${loc.longitude}`);
      console.log(`     Time: ${loc.timestamp}`);
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testDatabaseSchema().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ All database tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
});

