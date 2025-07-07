#!/usr/bin/env node

// Master Test Runner for Token Refresh System
// Run with: node tests/runAllTests.js

const { runTokenRefreshTests } = require('./tokenRefresh.test.js');
const { runAPIIntegrationTests } = require('./apiIntegration.test.js');
const { runFrontendComponentTests } = require('./frontendComponents.test.js');
const { runEndToEndTests } = require('./endToEnd.test.js');

async function runAllTests() {
  console.log('🧪 COMPREHENSIVE TOKEN REFRESH SYSTEM TESTS');
  console.log('='.repeat(60));
  console.log('Testing all components to ensure no functionality is broken\n');

  const results = {
    tokenRefresh: false,
    apiIntegration: false,
    frontendComponents: false,
    endToEnd: false
  };

  let totalPassed = 0;
  let totalFailed = 0;

  // Test 1: Token Refresh System
  console.log('1️⃣ TOKEN REFRESH SYSTEM TESTS');
  console.log('-'.repeat(40));
  try {
    results.tokenRefresh = await runTokenRefreshTests();
    if (results.tokenRefresh) totalPassed++; else totalFailed++;
  } catch (error) {
    console.log(`❌ Token refresh tests failed: ${error.message}`);
    totalFailed++;
  }
  console.log('');

  // Test 2: API Integration
  console.log('2️⃣ API INTEGRATION TESTS');
  console.log('-'.repeat(40));
  try {
    results.apiIntegration = await runAPIIntegrationTests();
    if (results.apiIntegration) totalPassed++; else totalFailed++;
  } catch (error) {
    console.log(`❌ API integration tests failed: ${error.message}`);
    totalFailed++;
  }
  console.log('');

  // Test 3: Frontend Components
  console.log('3️⃣ FRONTEND COMPONENT TESTS');
  console.log('-'.repeat(40));
  try {
    results.frontendComponents = await runFrontendComponentTests();
    if (results.frontendComponents) totalPassed++; else totalFailed++;
  } catch (error) {
    console.log(`❌ Frontend component tests failed: ${error.message}`);
    totalFailed++;
  }
  console.log('');

  // Test 4: End-to-End Workflows
  console.log('4️⃣ END-TO-END WORKFLOW TESTS');
  console.log('-'.repeat(40));
  try {
    results.endToEnd = await runEndToEndTests();
    if (results.endToEnd) totalPassed++; else totalFailed++;
  } catch (error) {
    console.log(`❌ End-to-end tests failed: ${error.message}`);
    totalFailed++;
  }
  console.log('');

  // Final Results
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log(`✅ Token Refresh System: ${results.tokenRefresh ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ API Integration: ${results.apiIntegration ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Frontend Components: ${results.frontendComponents ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ End-to-End Workflows: ${results.endToEnd ? 'PASSED' : 'FAILED'}`);
  
  console.log('');
  console.log(`📈 Overall: ${totalPassed}/4 test suites passed`);
  
  if (totalFailed === 0) {
    console.log('🎉 ALL TESTS PASSED! Token refresh system is safe to deploy.');
    console.log('');
    console.log('✅ DEPLOYMENT SAFETY CONFIRMED:');
    console.log('  • No existing functionality will be broken');
    console.log('  • Token refresh works correctly');
    console.log('  • API endpoints are compatible');
    console.log('  • Frontend components integrate properly');
    console.log('  • End-to-end workflows function as expected');
    console.log('');
    console.log('🚀 Ready for production deployment!');
    
    return true;
  } else {
    console.log(`❌ ${totalFailed} test suite(s) failed. Review and fix before deployment.`);
    console.log('');
    console.log('🚨 DEPLOYMENT RISKS:');
    
    if (!results.tokenRefresh) {
      console.log('  • Token refresh core functionality may be broken');
    }
    if (!results.apiIntegration) {
      console.log('  • API endpoints may not work correctly');
    }
    if (!results.frontendComponents) {
      console.log('  • Frontend components may have integration issues');
    }
    if (!results.endToEnd) {
      console.log('  • Complete user workflows may be disrupted');
    }
    
    console.log('');
    console.log('🔧 Fix the failing tests before deploying to production.');
    
    return false;
  }
}

// Additional utility functions for manual testing
function printTestInstructions() {
  console.log('📋 MANUAL TESTING INSTRUCTIONS');
  console.log('='.repeat(60));
  console.log('After automated tests pass, perform these manual tests:');
  console.log('');
  console.log('1️⃣ DRIVER LOGIN TEST:');
  console.log('  • Login as a driver');
  console.log('  • Check browser console for "12h" token expiry');
  console.log('  • Leave app open for 10+ minutes');
  console.log('  • Verify no authentication popups appear');
  console.log('');
  console.log('2️⃣ ADMIN LOGIN TEST:');
  console.log('  • Login as admin');
  console.log('  • Check browser console for "2h" token expiry');
  console.log('  • Verify admin functions work normally');
  console.log('');
  console.log('3️⃣ DELIVERY COMPLETION TEST:');
  console.log('  • Complete a delivery as driver');
  console.log('  • Verify no 404 error after completion');
  console.log('  • Check successful redirect to dashboard');
  console.log('');
  console.log('4️⃣ WEBSOCKET TEST:');
  console.log('  • Open driver dashboard');
  console.log('  • Check for WebSocket connection in console');
  console.log('  • Verify no authentication error popups');
  console.log('');
  console.log('5️⃣ MULTI-DEVICE TEST:');
  console.log('  • Login on different devices/browsers');
  console.log('  • Verify no authentication conflicts');
  console.log('');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then((success) => {
    if (success) {
      console.log('');
      printTestInstructions();
    }
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runAllTests, printTestInstructions };
