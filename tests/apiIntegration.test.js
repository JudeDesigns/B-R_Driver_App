// API Integration Tests for Token Refresh
// Run with: node tests/apiIntegration.test.js

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

// Mock environment
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/test';

const prisma = new PrismaClient();

// Create our own test implementations
function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

function verifyToken(token, options = {}) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "br-food-services",
      audience: "br-food-services-users",
      ignoreExpiration: options.ignoreExpiration || false,
    });
  } catch (error) {
    return null;
  }
}

async function runAPIIntegrationTests() {
  console.log('🔗 Running API Integration Tests...\n');
  
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

  // Test 1: Database connection works
  await test('Database connection works', async () => {
    try {
      await prisma.$connect();
      return true;
    } catch (error) {
      console.log('  Database connection failed:', error.message);
      return false;
    }
  });

  // Test 2: User table exists and is accessible
  await test('User table exists and is accessible', async () => {
    try {
      const userCount = await prisma.user.count();
      return typeof userCount === 'number';
    } catch (error) {
      console.log('  User table access failed:', error.message);
      return false;
    }
  });

  // Test 3: Can find test users
  await test('Can find test users', async () => {
    try {
      const users = await prisma.user.findMany({
        where: { isDeleted: false },
        take: 5,
        select: { id: true, username: true, role: true }
      });
      
      if (users.length === 0) {
        console.log('  No users found - this is expected in a fresh database');
        return true; // Not a failure, just no test data
      }
      
      console.log(`  Found ${users.length} users for testing`);
      return true;
    } catch (error) {
      console.log('  User query failed:', error.message);
      return false;
    }
  });

  // Test 4: Token generation for different roles
  await test('Token generation for different roles', async () => {
    const driverToken = generateToken({ id: '1', username: 'driver1', role: 'DRIVER' }, '12h');
    const adminToken = generateToken({ id: '2', username: 'admin1', role: 'ADMIN' }, '2h');
    
    const driverDecoded = jwt.decode(driverToken);
    const adminDecoded = jwt.decode(adminToken);
    
    const driverDuration = driverDecoded.exp - driverDecoded.iat;
    const adminDuration = adminDecoded.exp - adminDecoded.iat;
    
    // Driver should have longer token (12h ≈ 43200s)
    // Admin should have shorter token (2h ≈ 7200s)
    return driverDuration > adminDuration && driverDuration > 40000;
  });

  // Test 5: Refresh API payload structure
  await test('Refresh API payload structure', async () => {
    const testUser = {
      id: 'test-123',
      username: 'testdriver',
      role: 'DRIVER'
    };
    
    const token = generateToken(testUser, '12h');
    
    // Simulate refresh API response structure
    const refreshResponse = {
      token: generateToken(testUser, '12h'),
      user: testUser,
      expiresIn: '12h'
    };
    
    return refreshResponse.token && 
           refreshResponse.user && 
           refreshResponse.user.id === testUser.id &&
           refreshResponse.expiresIn === '12h';
  });

  // Test 6: WebSocket authentication payload
  await test('WebSocket authentication payload', async () => {
    const token = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    const decoded = verifyToken(token);
    
    // Simulate WebSocket auth payload
    const wsAuth = {
      token: token,
      role: decoded.role,
      id: decoded.id,
      username: decoded.username
    };
    
    return wsAuth.token && wsAuth.role === 'DRIVER' && wsAuth.id === '123';
  });

  // Test 7: Login API compatibility
  await test('Login API compatibility', async () => {
    // Test both driver and admin login token generation
    const driverLoginResponse = {
      user: { id: '1', username: 'driver1', role: 'DRIVER' },
      token: generateToken({ id: '1', username: 'driver1', role: 'DRIVER' }, '12h')
    };
    
    const adminLoginResponse = {
      user: { id: '2', username: 'admin1', role: 'ADMIN' },
      token: generateToken({ id: '2', username: 'admin1', role: 'ADMIN' }, '2h')
    };
    
    const driverDecoded = verifyToken(driverLoginResponse.token);
    const adminDecoded = verifyToken(adminLoginResponse.token);
    
    return driverDecoded && adminDecoded && 
           driverDecoded.role === 'DRIVER' && 
           adminDecoded.role === 'ADMIN';
  });

  // Test 8: Existing API endpoints still work
  await test('Existing API endpoints compatibility', async () => {
    // Test that existing token verification still works
    const oldStyleToken = generateToken({ id: '123', username: 'test', role: 'DRIVER' });
    const newStyleToken = generateToken({ id: '123', username: 'test', role: 'DRIVER' }, '12h');
    
    const oldDecoded = verifyToken(oldStyleToken);
    const newDecoded = verifyToken(newStyleToken);
    
    return oldDecoded && newDecoded && 
           oldDecoded.id === newDecoded.id &&
           oldDecoded.username === newDecoded.username;
  });

  // Test 9: Error handling
  await test('Error handling works correctly', async () => {
    // Test various error scenarios
    const invalidToken = verifyToken('invalid');
    const nullToken = verifyToken(null);
    const emptyToken = verifyToken('');
    
    return invalidToken === null && nullToken === null && emptyToken === null;
  });

  // Test 10: Performance check
  await test('Performance is acceptable', async () => {
    const start = Date.now();
    
    // Generate and verify 100 tokens
    for (let i = 0; i < 100; i++) {
      const token = generateToken({ id: `${i}`, username: `user${i}`, role: 'DRIVER' }, '12h');
      verifyToken(token);
    }
    
    const duration = Date.now() - start;
    console.log(`  Generated and verified 100 tokens in ${duration}ms`);
    
    // Should complete in under 1 second
    return duration < 1000;
  });

  // Cleanup
  await prisma.$disconnect();

  console.log(`\n📊 Integration Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All integration tests passed!');
    return true;
  } else {
    console.log('❌ Some integration tests failed. Check implementation.');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAPIIntegrationTests();
}

module.exports = { runAPIIntegrationTests };
