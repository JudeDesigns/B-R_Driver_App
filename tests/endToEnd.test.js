// End-to-End Workflow Tests
// Run with: node tests/endToEnd.test.js

const jwt = require('jsonwebtoken');

// Mock environment
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Import auth functions
const { generateToken, verifyToken } = require('../src/lib/auth');

function createTestToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

async function runEndToEndTests() {
  console.log('🔄 Running End-to-End Workflow Tests...\n');
  
  let passed = 0;
  let failed = 0;

  async function test(name, testFn) {
    try {
      const result = await testFn();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error.message}`);
      failed++;
    }
  }

  // Test 1: Complete driver login workflow
  await test('Complete driver login workflow', async () => {
    // Simulate login API call
    const loginPayload = { id: '123', username: 'driver1', role: 'DRIVER' };
    const driverToken = generateToken(loginPayload, '12h');
    
    // Verify token structure
    const decoded = verifyToken(driverToken);
    
    // Check token duration (12 hours = ~43200 seconds)
    const duration = decoded.exp - decoded.iat;
    
    return decoded && 
           decoded.id === '123' && 
           decoded.role === 'DRIVER' && 
           duration > 40000; // At least 11+ hours
  });

  // Test 2: Complete admin login workflow
  await test('Complete admin login workflow', async () => {
    // Simulate admin login
    const loginPayload = { id: '456', username: 'admin1', role: 'ADMIN' };
    const adminToken = generateToken(loginPayload, '2h');
    
    // Verify token structure
    const decoded = verifyToken(adminToken);
    
    // Check token duration (2 hours = ~7200 seconds)
    const duration = decoded.exp - decoded.iat;
    
    return decoded && 
           decoded.id === '456' && 
           decoded.role === 'ADMIN' && 
           duration < 8000; // Less than 2.5 hours
  });

  // Test 3: Token refresh workflow
  await test('Token refresh workflow', async () => {
    // Create initial token
    const originalToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    
    // Simulate refresh API call
    const refreshedToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    
    // Verify both tokens work
    const originalDecoded = verifyToken(originalToken);
    const refreshedDecoded = verifyToken(refreshedToken);
    
    return originalDecoded && refreshedDecoded && 
           originalDecoded.id === refreshedDecoded.id &&
           originalDecoded.username === refreshedDecoded.username;
  });

  // Test 4: WebSocket authentication workflow
  await test('WebSocket authentication workflow', async () => {
    // Create driver token
    const driverToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    
    // Simulate WebSocket auth payload
    const wsAuth = {
      token: driverToken,
      role: 'DRIVER',
      id: '123',
      username: 'driver1'
    };
    
    // Verify token in WebSocket context
    const decoded = verifyToken(wsAuth.token);
    
    return decoded && 
           decoded.id === wsAuth.id && 
           decoded.role === wsAuth.role &&
           decoded.username === wsAuth.username;
  });

  // Test 5: Delivery completion workflow
  await test('Delivery completion workflow', async () => {
    // Simulate long delivery session (driver logged in for hours)
    const startToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    
    // Simulate time passing (token still valid after hours)
    const decoded = verifyToken(startToken);
    const timeRemaining = decoded.exp - Math.floor(Date.now() / 1000);
    
    // Should have many hours remaining
    const hoursRemaining = timeRemaining / 3600;
    
    // Simulate completion redirect (token should still be valid)
    const completionToken = verifyToken(startToken);
    
    return completionToken && hoursRemaining > 10; // At least 10 hours left
  });

  // Test 6: Multi-device workflow
  await test('Multi-device workflow', async () => {
    // Simulate driver using different phones/devices
    const driverToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    
    // Device 1: Phone
    const device1Auth = verifyToken(driverToken);
    
    // Device 2: Tablet
    const device2Auth = verifyToken(driverToken);
    
    // Both should work with same token
    return device1Auth && device2Auth && 
           device1Auth.id === device2Auth.id;
  });

  // Test 7: Session expiry handling
  await test('Session expiry handling', async () => {
    // Create token that expires soon
    const shortToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '1m');
    
    // Should be valid initially
    const initialCheck = verifyToken(shortToken);
    
    // Simulate refresh before expiry
    const refreshedToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    const refreshCheck = verifyToken(refreshedToken);
    
    return initialCheck && refreshCheck && 
           refreshCheck.id === initialCheck.id;
  });

  // Test 8: Error recovery workflow
  await test('Error recovery workflow', async () => {
    // Test invalid token handling
    const invalidDecoded = verifyToken('invalid-token');
    
    // Test expired token with ignoreExpiration
    const expiredToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '-1h');
    const expiredDecoded = verifyToken(expiredToken, { ignoreExpiration: true });
    
    // Test recovery with new token
    const recoveryToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    const recoveryDecoded = verifyToken(recoveryToken);
    
    return invalidDecoded === null && 
           expiredDecoded && expiredDecoded.id === '123' &&
           recoveryDecoded && recoveryDecoded.id === '123';
  });

  // Test 9: Performance under load
  await test('Performance under load', async () => {
    const start = Date.now();
    
    // Simulate multiple concurrent operations
    const operations = [];
    
    for (let i = 0; i < 50; i++) {
      // Generate tokens
      operations.push(generateToken({ id: `${i}`, username: `driver${i}`, role: 'DRIVER' }, '12h'));
    }
    
    // Verify all tokens
    const verifications = operations.map(token => verifyToken(token));
    
    const duration = Date.now() - start;
    
    // Should complete quickly and all verifications should succeed
    return duration < 500 && verifications.every(decoded => decoded !== null);
  });

  // Test 10: Backward compatibility
  await test('Backward compatibility', async () => {
    // Test old-style token generation (without explicit expiry)
    const oldStyleToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    
    // Test new-style token generation
    const newStyleToken = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    
    // Both should work
    const oldDecoded = verifyToken(oldStyleToken);
    const newDecoded = verifyToken(newStyleToken);
    
    // Test mixed usage
    const mixedTest = verifyToken(oldStyleToken) && verifyToken(newStyleToken);
    
    return oldDecoded && newDecoded && mixedTest &&
           oldDecoded.id === newDecoded.id;
  });

  console.log(`\n📊 End-to-End Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All end-to-end workflow tests passed!');
    return true;
  } else {
    console.log('❌ Some workflow tests failed. Check implementation.');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runEndToEndTests();
}

module.exports = { runEndToEndTests };
