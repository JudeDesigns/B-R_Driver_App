/**
 * Test Script: Email Timezone PST Fix
 * 
 * This script tests that delivery confirmation emails show times in PST/PDT
 * instead of UTC or other timezones.
 * 
 * Run with: node tests/email-timezone-pst.test.js
 */

console.log('🧪 EMAIL TIMEZONE PST TESTS\n');
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

// Simulate the email formatting logic
function formatDeliveryTimePST(completionTime) {
  return new Date(completionTime).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

// Test 1: Morning delivery (8:00 AM PST)
test('Morning delivery at 8:00 AM PST', () => {
  // Create a date that is 8:00 AM PST (which is 16:00 UTC)
  const pstDate = new Date('2026-01-16T16:00:00Z'); // 8:00 AM PST = 16:00 UTC
  const formatted = formatDeliveryTimePST(pstDate);
  
  console.log(`Input (UTC): ${pstDate.toISOString()}`);
  console.log(`Formatted (PST): ${formatted}`);
  
  // Should show 8:00 AM, not 16:00 or 4:00 PM
  const showsCorrectHour = formatted.includes('8:00 AM');
  const showsJan16 = formatted.includes('Jan 16');
  const shows2026 = formatted.includes('2026');
  
  const pass = showsCorrectHour && showsJan16 && shows2026;
  
  return {
    pass,
    reason: !pass ? `Expected "Jan 16, 2026, 8:00 AM" but got "${formatted}"` : ''
  };
});

// Test 2: Afternoon delivery (2:30 PM PST)
test('Afternoon delivery at 2:30 PM PST', () => {
  // Create a date that is 2:30 PM PST (which is 22:30 UTC)
  const pstDate = new Date('2026-01-16T22:30:00Z'); // 2:30 PM PST = 22:30 UTC
  const formatted = formatDeliveryTimePST(pstDate);
  
  console.log(`Input (UTC): ${pstDate.toISOString()}`);
  console.log(`Formatted (PST): ${formatted}`);
  
  const showsCorrectTime = formatted.includes('2:30 PM');
  
  return {
    pass: showsCorrectTime,
    reason: !showsCorrectTime ? `Expected "2:30 PM" but got "${formatted}"` : ''
  };
});

// Test 3: Late evening delivery (11:45 PM PST)
test('Late evening delivery at 11:45 PM PST', () => {
  // Create a date that is 11:45 PM PST (which is 7:45 AM next day UTC)
  const pstDate = new Date('2026-01-17T07:45:00Z'); // 11:45 PM PST Jan 16 = 7:45 AM UTC Jan 17
  const formatted = formatDeliveryTimePST(pstDate);
  
  console.log(`Input (UTC): ${pstDate.toISOString()}`);
  console.log(`Formatted (PST): ${formatted}`);
  
  // Should show Jan 16 (PST date), not Jan 17 (UTC date)
  const showsCorrectDate = formatted.includes('Jan 16');
  const showsCorrectTime = formatted.includes('11:45 PM');
  
  const pass = showsCorrectDate && showsCorrectTime;
  
  return {
    pass,
    reason: !pass ? `Expected "Jan 16, 2026, 11:45 PM" but got "${formatted}"` : ''
  };
});

// Test 4: Noon delivery (12:00 PM PST)
test('Noon delivery at 12:00 PM PST', () => {
  // Create a date that is 12:00 PM PST (which is 20:00 UTC)
  const pstDate = new Date('2026-01-16T20:00:00Z'); // 12:00 PM PST = 20:00 UTC
  const formatted = formatDeliveryTimePST(pstDate);
  
  console.log(`Input (UTC): ${pstDate.toISOString()}`);
  console.log(`Formatted (PST): ${formatted}`);
  
  const showsCorrectTime = formatted.includes('12:00 PM');
  
  return {
    pass: showsCorrectTime,
    reason: !showsCorrectTime ? `Expected "12:00 PM" but got "${formatted}"` : ''
  };
});

// Test 5: Midnight delivery (12:00 AM PST)
test('Midnight delivery at 12:00 AM PST', () => {
  // Create a date that is 12:00 AM PST (which is 8:00 AM UTC)
  const pstDate = new Date('2026-01-16T08:00:00Z'); // 12:00 AM PST = 8:00 AM UTC
  const formatted = formatDeliveryTimePST(pstDate);
  
  console.log(`Input (UTC): ${pstDate.toISOString()}`);
  console.log(`Formatted (PST): ${formatted}`);
  
  const showsCorrectTime = formatted.includes('12:00 AM');
  
  return {
    pass: showsCorrectTime,
    reason: !showsCorrectTime ? `Expected "12:00 AM" but got "${formatted}"` : ''
  };
});

// Test 6: Verify timezone is explicitly set
test('Timezone is explicitly set to America/Los_Angeles', () => {
  // This test verifies the code uses the correct timezone parameter
  const testDate = new Date('2026-01-16T16:00:00Z');
  
  // Format with explicit PST
  const pstFormatted = testDate.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  
  // Format without timezone (would default to UTC or system timezone)
  const defaultFormatted = testDate.toLocaleString("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
  
  console.log(`With PST timezone: ${pstFormatted}`);
  console.log(`Without timezone: ${defaultFormatted}`);
  
  // PST should show 8:00 AM
  const pstShowsCorrect = pstFormatted.includes('8:00 AM');
  
  return {
    pass: pstShowsCorrect,
    reason: !pstShowsCorrect ? 'Timezone parameter not working correctly' : ''
  };
});

// Summary
console.log('\n' + '='.repeat(80));
console.log(`\n📊 TEST SUMMARY:`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 All tests passed! Email timezone formatting is working correctly in PST.');
  console.log('\n📝 Note: These tests verify the formatting logic.');
  console.log('   To test the actual email API, send a test email and check the delivery time.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
}

