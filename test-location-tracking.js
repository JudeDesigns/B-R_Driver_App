/**
 * Location Tracking Test Script
 * Tests all Phase 5 location tracking functionality
 */

const BASE_URL = 'http://localhost:3000';

// Test data
const ADMIN_CREDENTIALS = {
  username: 'Administrator',
  password: 'Administrator'
};

const DRIVER_CREDENTIALS = {
  username: 'Glen',
  password: 'Glen123'
};

// Test location data
const TEST_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10
};

let adminToken = null;
let driverToken = null;
let testRouteId = null;
let testStopId = null;

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  const data = await response.json();
  return { status: response.status, data };
}

// Test 1: Admin Login
async function testAdminLogin() {
  console.log('\n📝 Test 1: Admin Login');
  const result = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(ADMIN_CREDENTIALS)
  });
  
  if (result.status === 200 && result.data.token) {
    adminToken = result.data.token;
    console.log('✅ Admin login successful');
    return true;
  } else {
    console.log('❌ Admin login failed:', result.data);
    return false;
  }
}

// Test 2: Driver Login
async function testDriverLogin() {
  console.log('\n📝 Test 2: Driver Login');
  const result = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(DRIVER_CREDENTIALS)
  });
  
  if (result.status === 200 && result.data.token) {
    driverToken = result.data.token;
    console.log('✅ Driver login successful');
    return true;
  } else {
    console.log('❌ Driver login failed:', result.data);
    return false;
  }
}

// Test 3: Get Driver's Active Routes
async function testGetDriverRoutes() {
  console.log('\n📝 Test 3: Get Driver Routes');
  const result = await apiCall('/api/driver/routes', {
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  
  if (result.status === 200 && result.data.routes) {
    console.log(`✅ Found ${result.data.routes.length} routes`);
    if (result.data.routes.length > 0) {
      testRouteId = result.data.routes[0].id;
      console.log(`   Using route ID: ${testRouteId}`);
      
      // Get stops for this route
      const stopsResult = await apiCall(`/api/driver/routes/${testRouteId}`, {
        headers: { Authorization: `Bearer ${driverToken}` }
      });
      
      if (stopsResult.status === 200 && stopsResult.data.stops && stopsResult.data.stops.length > 0) {
        testStopId = stopsResult.data.stops[0].id;
        console.log(`   Using stop ID: ${testStopId}`);
      }
    }
    return true;
  } else {
    console.log('❌ Failed to get routes:', result.data);
    return false;
  }
}

// Test 4: Send Location Update (Driver API)
async function testSendLocationUpdate() {
  console.log('\n📝 Test 4: Send Location Update');
  
  if (!testRouteId || !testStopId) {
    console.log('⚠️  Skipping - No route/stop available');
    return false;
  }
  
  const result = await apiCall('/api/driver/location', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({
      routeId: testRouteId,
      stopId: testStopId,
      ...TEST_LOCATION
    })
  });
  
  if (result.status === 200) {
    console.log('✅ Location update sent successfully');
    console.log('   Response:', result.data.message);
    return true;
  } else {
    console.log('❌ Location update failed:', result.data);
    return false;
  }
}

// Test 5: Get Driver Locations (Admin API)
async function testGetDriverLocations() {
  console.log('\n📝 Test 5: Get Driver Locations (Admin)');
  
  // Wait a moment for database to update
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const result = await apiCall('/api/admin/drivers/locations?activeOnly=false', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  
  if (result.status === 200) {
    console.log(`✅ Retrieved ${result.data.count} driver locations`);
    if (result.data.drivers && result.data.drivers.length > 0) {
      const driver = result.data.drivers[0];
      console.log(`   Driver: ${driver.fullName || driver.username}`);
      console.log(`   Location: ${driver.lastKnownLatitude}, ${driver.lastKnownLongitude}`);
      console.log(`   Accuracy: ±${driver.locationAccuracy}m`);
      console.log(`   Last Update: ${driver.lastLocationUpdate}`);
    }
    return true;
  } else {
    console.log('❌ Failed to get driver locations:', result.data);
    return false;
  }
}

// Test 6: Filter Active Drivers Only
async function testFilterActiveDrivers() {
  console.log('\n📝 Test 6: Filter Active Drivers (Last 30 min)');
  
  const result = await apiCall('/api/admin/drivers/locations?activeOnly=true', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  
  if (result.status === 200) {
    console.log(`✅ Retrieved ${result.data.count} active drivers`);
    return true;
  } else {
    console.log('❌ Failed to filter active drivers:', result.data);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Location Tracking Tests...');
  console.log('=' .repeat(50));
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0
  };
  
  try {
    // Authentication tests
    if (await testAdminLogin()) results.passed++; else results.failed++;
    if (await testDriverLogin()) results.passed++; else results.failed++;
    
    // Driver tests
    if (await testGetDriverRoutes()) results.passed++; else results.failed++;
    if (await testSendLocationUpdate()) results.passed++; else results.failed++;
    
    // Admin tests
    if (await testGetDriverLocations()) results.passed++; else results.failed++;
    if (await testFilterActiveDrivers()) results.passed++; else results.failed++;
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    results.failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results Summary:');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log(`   ⚠️  Skipped: ${results.skipped}`);
  console.log('='.repeat(50));
  
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests();

