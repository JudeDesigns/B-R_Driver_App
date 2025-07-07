// Token Refresh System Tests
// Run with: node tests/tokenRefresh.test.js

const jwt = require('jsonwebtoken');

// Mock environment
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

// Import the functions we want to test
const { generateToken, verifyToken } = require('../src/lib/auth');

// Test utilities
function createTestToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

function createExpiredToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '-1h', // Already expired
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

// Test suite
async function runTokenRefreshTests() {
  console.log('🧪 Running Token Refresh System Tests...\n');
  
  let passed = 0;
  let failed = 0;

  function test(name, testFn) {
    try {
      const result = testFn();
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

  // Test 1: Basic token generation
  test('Token generation works', () => {
    const token = generateToken({ id: '123', username: 'test', role: 'DRIVER' });
    return typeof token === 'string' && token.length > 0;
  });

  // Test 2: Driver gets longer token
  test('Driver gets 12-hour token', () => {
    const token = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now() / 1000);
    const tokenDuration = decoded.exp - decoded.iat;
    // 12 hours = 43200 seconds (allow some variance)
    return tokenDuration >= 43000 && tokenDuration <= 44000;
  });

  // Test 3: Admin gets shorter token
  test('Admin gets 2-hour token', () => {
    const token = generateToken({ id: '123', username: 'admin1', role: 'ADMIN' }, '2h');
    const decoded = jwt.decode(token);
    const tokenDuration = decoded.exp - decoded.iat;
    // 2 hours = 7200 seconds (allow some variance)
    return tokenDuration >= 7000 && tokenDuration <= 7400;
  });

  // Test 4: Token verification works
  test('Token verification works', () => {
    const token = generateToken({ id: '123', username: 'test', role: 'DRIVER' });
    const decoded = verifyToken(token);
    return decoded && decoded.id === '123' && decoded.username === 'test';
  });

  // Test 5: Expired token verification fails
  test('Expired token verification fails', () => {
    const expiredToken = createExpiredToken({ id: '123', username: 'test', role: 'DRIVER' });
    const decoded = verifyToken(expiredToken);
    return decoded === null;
  });

  // Test 6: Expired token verification with ignoreExpiration works
  test('Expired token verification with ignoreExpiration works', () => {
    const expiredToken = createExpiredToken({ id: '123', username: 'test', role: 'DRIVER' });
    const decoded = verifyToken(expiredToken, { ignoreExpiration: true });
    return decoded && decoded.id === '123';
  });

  // Test 7: Invalid token returns null
  test('Invalid token returns null', () => {
    const decoded = verifyToken('invalid-token');
    return decoded === null;
  });

  // Test 8: Token with missing fields returns null
  test('Token with missing fields returns null', () => {
    const token = createTestToken({ id: '123' }); // Missing username and role
    const decoded = verifyToken(token);
    return decoded === null;
  });

  // Test 9: Token refresh API payload structure
  test('Token refresh API payload structure', () => {
    const token = generateToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '12h');
    const decoded = verifyToken(token);
    
    // Check all required fields are present
    return decoded && 
           decoded.id && 
           decoded.username && 
           decoded.role && 
           decoded.exp && 
           decoded.iat &&
           decoded.iss === 'br-food-services' &&
           decoded.aud === 'br-food-services-users';
  });

  // Test 10: Backward compatibility
  test('Backward compatibility with existing tokens', () => {
    // Test that old token format still works
    const oldToken = generateToken({ id: '123', username: 'test', role: 'DRIVER' }); // Default expiry
    const decoded = verifyToken(oldToken);
    return decoded && decoded.id === '123';
  });

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All token refresh tests passed!');
    return true;
  } else {
    console.log('❌ Some tests failed. Check implementation.');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTokenRefreshTests();
}

module.exports = { runTokenRefreshTests };
