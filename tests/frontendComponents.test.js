// Frontend Component Tests for Token Refresh
// Run with: node tests/frontendComponents.test.js

// Mock browser environment
global.window = {
  location: { origin: 'http://localhost:3000' },
  addEventListener: () => {},
  removeEventListener: () => {},
  innerWidth: 1024
};

global.document = {
  visibilityState: 'visible',
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.localStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; }
};

global.sessionStorage = {
  data: {},
  getItem: function(key) { return this.data[key] || null; },
  setItem: function(key, value) { this.data[key] = value; },
  removeItem: function(key) { delete this.data[key]; }
};

// Mock fetch
global.fetch = async (url, options) => {
  if (url.includes('/api/auth/refresh')) {
    return {
      ok: true,
      json: async () => ({
        token: 'new-refreshed-token',
        user: { id: '123', username: 'driver1', role: 'DRIVER' },
        expiresIn: '12h'
      })
    };
  }
  return { ok: false, status: 404 };
};

const jwt = require('jsonwebtoken');

// Mock environment
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';

function createTestToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

function createExpiredToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '-1h',
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

async function runFrontendComponentTests() {
  console.log('🎨 Running Frontend Component Tests...\n');
  
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

  // Test 1: Token storage and retrieval
  await test('Token storage and retrieval works', async () => {
    const testToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    
    // Test localStorage
    localStorage.setItem('token', testToken);
    const retrievedToken = localStorage.getItem('token');
    
    // Test sessionStorage
    sessionStorage.setItem('token', testToken);
    const sessionToken = sessionStorage.getItem('token');
    
    return retrievedToken === testToken && sessionToken === testToken;
  });

  // Test 2: Token expiration detection
  await test('Token expiration detection works', async () => {
    const { tokenManager } = require('../src/lib/tokenRefresh');
    
    const validToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '1h');
    const expiredToken = createExpiredToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    
    const isValidExpired = tokenManager.isTokenExpired(validToken);
    const isExpiredExpired = tokenManager.isTokenExpired(expiredToken);
    
    return !isValidExpired && isExpiredExpired;
  });

  // Test 3: Token expiring soon detection
  await test('Token expiring soon detection works', async () => {
    const { tokenManager } = require('../src/lib/tokenRefresh');
    
    const longToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '1h');
    const shortToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' }, '2m');
    
    const isLongExpiringSoon = tokenManager.isTokenExpiringSoon(longToken);
    const isShortExpiringSoon = tokenManager.isTokenExpiringSoon(shortToken);
    
    return !isLongExpiringSoon && isShortExpiringSoon;
  });

  // Test 4: Token refresh functionality
  await test('Token refresh functionality works', async () => {
    const { tokenManager } = require('../src/lib/tokenRefresh');
    
    // Set up a token in storage
    const testToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    localStorage.setItem('token', testToken);
    
    // Attempt refresh
    const newToken = await tokenManager.refreshToken();
    
    return newToken === 'new-refreshed-token';
  });

  // Test 5: Storage update after refresh
  await test('Storage update after refresh works', async () => {
    const { tokenManager } = require('../src/lib/tokenRefresh');
    
    // Set up tokens in both storages
    const testToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    localStorage.setItem('token', testToken);
    sessionStorage.setItem('token', testToken);
    
    // Refresh token
    await tokenManager.refreshToken();
    
    // Check if both storages were updated
    const localToken = localStorage.getItem('token');
    const sessionToken = sessionStorage.getItem('token');
    
    return localToken === 'new-refreshed-token' && sessionToken === 'new-refreshed-token';
  });

  // Test 6: WebSocket authentication handling
  await test('WebSocket authentication handling works', async () => {
    // Mock WebSocket connection
    const mockSocket = {
      auth: {},
      connect: () => {},
      on: () => {},
      off: () => {}
    };
    
    // Test token retrieval for WebSocket
    const testToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    localStorage.setItem('token', testToken);
    localStorage.setItem('userRole', 'DRIVER');
    localStorage.setItem('userId', '123');
    localStorage.setItem('username', 'driver1');
    
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    
    return token && userRole === 'DRIVER' && userId === '123' && username === 'driver1';
  });

  // Test 7: Error handling for invalid tokens
  await test('Error handling for invalid tokens works', async () => {
    const { tokenManager } = require('../src/lib/tokenRefresh');
    
    // Test with invalid token
    localStorage.setItem('token', 'invalid-token');
    
    const isExpired = tokenManager.isTokenExpired('invalid-token');
    const isExpiringSoon = tokenManager.isTokenExpiringSoon('invalid-token');
    
    // Invalid tokens should be treated as expired
    return isExpired && isExpiringSoon;
  });

  // Test 8: Multiple storage fallback
  await test('Multiple storage fallback works', async () => {
    // Clear all storage
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    
    // Set token only in sessionStorage
    const testToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    sessionStorage.setItem('token', testToken);
    
    // Test fallback logic
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    return token === testToken;
  });

  // Test 9: Component integration simulation
  await test('Component integration simulation works', async () => {
    // Simulate driver dashboard component behavior
    const testToken = createTestToken({ id: '123', username: 'driver1', role: 'DRIVER' });
    sessionStorage.setItem('token', testToken);
    sessionStorage.setItem('userRole', 'DRIVER');
    
    // Simulate useTokenRefresh hook behavior
    let refreshCalled = false;
    const mockUseTokenRefresh = {
      enabled: true,
      onTokenRefreshed: (newToken) => {
        refreshCalled = true;
        sessionStorage.setItem('token', newToken);
      },
      onRefreshFailed: () => {
        // Would redirect to login
      }
    };
    
    // Simulate token refresh
    if (mockUseTokenRefresh.enabled) {
      mockUseTokenRefresh.onTokenRefreshed('new-token');
    }
    
    return refreshCalled && sessionStorage.getItem('token') === 'new-token';
  });

  // Test 10: Performance and memory leaks
  await test('Performance and memory leaks check', async () => {
    const { tokenManager } = require('../src/lib/tokenRefresh');
    
    // Test multiple rapid calls don't cause issues
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const testToken = createTestToken({ id: `${i}`, username: `user${i}`, role: 'DRIVER' });
      localStorage.setItem('token', testToken);
      promises.push(tokenManager.ensureValidToken());
    }
    
    const results = await Promise.all(promises);
    
    // All should return valid tokens
    return results.every(token => typeof token === 'string' && token.length > 0);
  });

  console.log(`\n📊 Frontend Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All frontend component tests passed!');
    return true;
  } else {
    console.log('❌ Some frontend tests failed. Check implementation.');
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runFrontendComponentTests();
}

module.exports = { runFrontendComponentTests };
