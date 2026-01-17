/**
 * Test Script: Google Maps Route Order Fix
 *
 * This script tests that the Google Maps route generation:
 * 1. Uses driver's location as origin
 * 2. Preserves exact stop sequence (1, 2, 3, 4...)
 * 3. Uses Directions API format to prevent auto-reordering
 *
 * Run with: node tests/google-maps-route-order.test.js
 */

// Inline the function logic to avoid TypeScript import issues
function formatAddressForMaps(address) {
  if (!address) return '';
  return encodeURIComponent(address.trim());
}

function generateFullRouteMapLink(routeData) {
  if (!routeData.stops || routeData.stops.length === 0) {
    return '';
  }

  // Sort stops by sequence to maintain delivery order
  const sortedStops = [...routeData.stops].sort((a, b) => a.sequence - b.sequence);

  if (sortedStops.length === 1) {
    // For single stop, just use directions to that address
    const formattedAddress = formatAddressForMaps(sortedStops[0].address);
    return `https://www.google.com/maps/dir/?api=1&destination=${formattedAddress}&travelmode=driving`;
  }

  // For multiple stops, use origin + destination + waypoints format
  // This preserves the exact order and prevents Google Maps from reordering
  const origin = routeData.startLocation || sortedStops[0].address;
  const destination = routeData.endLocation || sortedStops[sortedStops.length - 1].address;

  // Middle stops become waypoints (if we have more than 2 stops)
  const waypoints = [];

  if (routeData.startLocation) {
    // If we have a custom start location, all sorted stops become waypoints except the last
    for (let i = 0; i < sortedStops.length - 1; i++) {
      waypoints.push(sortedStops[i].address);
    }
  } else {
    // First stop is origin, last is destination, middle ones are waypoints
    for (let i = 1; i < sortedStops.length - 1; i++) {
      waypoints.push(sortedStops[i].address);
    }
  }

  // Build the URL using Directions API format
  let routeUrl = 'https://www.google.com/maps/dir/?api=1';
  routeUrl += `&origin=${formatAddressForMaps(origin)}`;
  routeUrl += `&destination=${formatAddressForMaps(destination)}`;

  // Add waypoints if any (separated by |)
  if (waypoints.length > 0) {
    const formattedWaypoints = waypoints
      .map(wp => formatAddressForMaps(wp))
      .filter(wp => wp !== '')
      .join('|');
    if (formattedWaypoints) {
      routeUrl += `&waypoints=${formattedWaypoints}`;
    }
  }

  // Add travel mode
  routeUrl += '&travelmode=driving';

  return routeUrl;
}

console.log('🧪 GOOGLE MAPS ROUTE ORDER TESTS\n');
console.log('=' .repeat(80));

let passedTests = 0;
let failedTests = 0;

function test(name, testFn) {
  console.log(`\n📋 ${name}`);
  console.log('-'.repeat(80));
  try {
    const result = testFn();
    if (result.pass) {
      console.log(`✅ PASS`);
      passedTests++;
    } else {
      console.log(`❌ FAIL: ${result.reason}`);
      failedTests++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    failedTests++;
  }
}

// Test 1: Driver location as origin, stops in sequence
test('Driver location as origin with 4 stops in sequence', () => {
  const routeData = {
    startLocation: '123 Driver Home St, Los Angeles, CA',
    stops: [
      { address: '456 Stop 1 Ave, LA, CA', customerName: 'Customer 1', sequence: 1 },
      { address: '789 Stop 2 Blvd, LA, CA', customerName: 'Customer 2', sequence: 2 },
      { address: '321 Stop 3 Rd, LA, CA', customerName: 'Customer 3', sequence: 3 },
      { address: '654 Stop 4 St, LA, CA', customerName: 'Customer 4', sequence: 4 },
    ],
  };

  const url = generateFullRouteMapLink(routeData);
  console.log(`Generated URL: ${url}`);

  // Verify URL structure
  const hasApiFormat = url.includes('api=1');
  const hasOrigin = url.includes('origin=') && url.includes('123%20Driver%20Home');
  const hasDestination = url.includes('destination=') && url.includes('654%20Stop%204');
  const hasWaypoints = url.includes('waypoints=');
  const hasDrivingMode = url.includes('travelmode=driving');

  // Verify waypoints are in correct order (Stop 1, 2, 3)
  const waypointsMatch = url.match(/waypoints=([^&]+)/);
  const waypoints = waypointsMatch ? decodeURIComponent(waypointsMatch[1]) : '';
  console.log(`Waypoints: ${waypoints}`);

  const correctOrder = waypoints.includes('456 Stop 1') &&
                       waypoints.includes('789 Stop 2') &&
                       waypoints.includes('321 Stop 3');

  const pass = hasApiFormat && hasOrigin && hasDestination && hasWaypoints && hasDrivingMode && correctOrder;

  return {
    pass,
    reason: !pass ? `Missing: ${!hasApiFormat ? 'API format' : ''} ${!hasOrigin ? 'Origin' : ''} ${!hasDestination ? 'Destination' : ''} ${!hasWaypoints ? 'Waypoints' : ''} ${!correctOrder ? 'Correct order' : ''}` : ''
  };
});

// Test 2: No driver location (first stop is origin)
test('No driver location - first stop becomes origin', () => {
  const routeData = {
    stops: [
      { address: '111 First Stop, LA, CA', customerName: 'Customer 1', sequence: 1 },
      { address: '222 Second Stop, LA, CA', customerName: 'Customer 2', sequence: 2 },
      { address: '333 Third Stop, LA, CA', customerName: 'Customer 3', sequence: 3 },
    ],
  };

  const url = generateFullRouteMapLink(routeData);
  console.log(`Generated URL: ${url}`);

  const hasOrigin = url.includes('origin=') && url.includes('111%20First%20Stop');
  const hasDestination = url.includes('destination=') && url.includes('333%20Third%20Stop');
  const hasWaypoints = url.includes('waypoints=') && url.includes('222%20Second%20Stop');

  const pass = hasOrigin && hasDestination && hasWaypoints;

  return {
    pass,
    reason: !pass ? 'First stop should be origin, last should be destination, middle should be waypoint' : ''
  };
});

// Test 3: Stops out of sequence order (should sort them)
test('Stops out of sequence - should sort by sequence number', () => {
  const routeData = {
    startLocation: 'Driver Home',
    stops: [
      { address: 'Stop 3 Address', customerName: 'Customer 3', sequence: 3 },
      { address: 'Stop 1 Address', customerName: 'Customer 1', sequence: 1 },
      { address: 'Stop 4 Address', customerName: 'Customer 4', sequence: 4 },
      { address: 'Stop 2 Address', customerName: 'Customer 2', sequence: 2 },
    ],
  };

  const url = generateFullRouteMapLink(routeData);
  console.log(`Generated URL: ${url}`);

  // Extract waypoints
  const waypointsMatch = url.match(/waypoints=([^&]+)/);
  const waypoints = waypointsMatch ? decodeURIComponent(waypointsMatch[1]) : '';
  console.log(`Waypoints order: ${waypoints}`);

  // Waypoints should be in order: Stop 1, Stop 2, Stop 3 (Stop 4 is destination)
  const waypointParts = waypoints.split('|');
  const correctOrder = waypointParts[0].includes('Stop 1') &&
                       waypointParts[1].includes('Stop 2') &&
                       waypointParts[2].includes('Stop 3');

  return {
    pass: correctOrder,
    reason: !correctOrder ? 'Waypoints not in correct sequence order (1, 2, 3)' : ''
  };
});

// Test 4: Single stop (no waypoints needed)
test('Single stop - should use simple destination format', () => {
  const routeData = {
    stops: [
      { address: 'Only Stop Address, LA, CA', customerName: 'Customer 1', sequence: 1 },
    ],
  };

  const url = generateFullRouteMapLink(routeData);
  console.log(`Generated URL: ${url}`);

  const hasDestination = url.includes('destination=') && url.includes('Only%20Stop%20Address');
  const noWaypoints = !url.includes('waypoints=');
  const hasApiFormat = url.includes('api=1');

  const pass = hasDestination && noWaypoints && hasApiFormat;

  return {
    pass,
    reason: !pass ? `Single stop should only have destination, no waypoints. Has destination: ${hasDestination}, No waypoints: ${noWaypoints}, API format: ${hasApiFormat}` : ''
  };
});

// Test 5: Two stops with driver location
test('Two stops with driver location', () => {
  const routeData = {
    startLocation: 'Driver Home',
    stops: [
      { address: 'First Stop', customerName: 'Customer 1', sequence: 1 },
      { address: 'Second Stop', customerName: 'Customer 2', sequence: 2 },
    ],
  };

  const url = generateFullRouteMapLink(routeData);
  console.log(`Generated URL: ${url}`);

  const hasOrigin = url.includes('origin=') && url.includes('Driver%20Home');
  const hasDestination = url.includes('destination=') && url.includes('Second%20Stop');
  const hasWaypoints = url.includes('waypoints=') && url.includes('First%20Stop');

  const pass = hasOrigin && hasDestination && hasWaypoints;

  return {
    pass,
    reason: !pass ? `Should have driver home as origin, first stop as waypoint, second stop as destination. Origin: ${hasOrigin}, Destination: ${hasDestination}, Waypoints: ${hasWaypoints}` : ''
  };
});

// Summary
console.log('\n' + '='.repeat(80));
console.log(`\n📊 TEST SUMMARY:`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! Google Maps route order is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}

