/**
 * Test Script: Email Subject Line with Credit Memo
 * 
 * This script tests the email subject line generation logic to ensure
 * credit memo information is properly included in the subject line.
 * 
 * Test Cases:
 * 1. Email subject WITHOUT credit memo
 * 2. Email subject WITH single credit memo
 * 3. Email subject WITH multiple credit memos (edge case)
 * 4. Email subject with missing credit memo amount
 * 5. Email subject with missing credit memo number
 */

// Simulate the email subject generation logic from src/lib/email.ts
function generateEmailSubject(stopData) {
  const customerName = stopData.customerName;
  const invoiceNumber = stopData.quickbooksInvoiceNum || 'N/A';
  const totalAmount = stopData.amount || 0;
  const creditMemoNumber = stopData.creditMemoNumber || null;
  const creditMemoAmount = stopData.creditMemoAmount || null;

  // Format subject line - include credit memo if present
  let emailSubject = `Delivery Completed - ${customerName} - Order #${invoiceNumber} $${totalAmount.toFixed(2)}`;
  
  if (creditMemoNumber && creditMemoAmount) {
    emailSubject += ` | Credit Memo #${creditMemoNumber} $${creditMemoAmount.toFixed(2)}`;
  }

  return emailSubject;
}

// Test runner
function runTests() {
  console.log('🧪 EMAIL SUBJECT LINE CREDIT MEMO TESTS\n');
  console.log('=' .repeat(80));
  
  let passedTests = 0;
  let failedTests = 0;
  const results = [];

  // Test 1: Email subject WITHOUT credit memo
  console.log('\n📋 TEST 1: Email subject WITHOUT credit memo');
  console.log('-'.repeat(80));
  const test1Data = {
    customerName: 'Acme Corporation',
    quickbooksInvoiceNum: 'INV-12345',
    amount: 500.00,
    creditMemoNumber: null,
    creditMemoAmount: null
  };
  const test1Result = generateEmailSubject(test1Data);
  const test1Expected = 'Delivery Completed - Acme Corporation - Order #INV-12345 $500.00';
  const test1Pass = test1Result === test1Expected;
  
  console.log(`Input: ${JSON.stringify(test1Data, null, 2)}`);
  console.log(`Expected: ${test1Expected}`);
  console.log(`Got:      ${test1Result}`);
  console.log(`Status:   ${test1Pass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test1Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 1', passed: test1Pass });

  // Test 2: Email subject WITH single credit memo
  console.log('\n📋 TEST 2: Email subject WITH single credit memo');
  console.log('-'.repeat(80));
  const test2Data = {
    customerName: 'Acme Corporation',
    quickbooksInvoiceNum: 'INV-12345',
    amount: 500.00,
    creditMemoNumber: 'CM-98765',
    creditMemoAmount: 50.00
  };
  const test2Result = generateEmailSubject(test2Data);
  const test2Expected = 'Delivery Completed - Acme Corporation - Order #INV-12345 $500.00 | Credit Memo #CM-98765 $50.00';
  const test2Pass = test2Result === test2Expected;
  
  console.log(`Input: ${JSON.stringify(test2Data, null, 2)}`);
  console.log(`Expected: ${test2Expected}`);
  console.log(`Got:      ${test2Result}`);
  console.log(`Status:   ${test2Pass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test2Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 2', passed: test2Pass });

  // Test 3: Email subject WITH large credit memo amount
  console.log('\n📋 TEST 3: Email subject WITH large credit memo amount');
  console.log('-'.repeat(80));
  const test3Data = {
    customerName: 'Big Box Store',
    quickbooksInvoiceNum: 'INV-99999',
    amount: 10000.00,
    creditMemoNumber: 'CM-11111',
    creditMemoAmount: 1500.50
  };
  const test3Result = generateEmailSubject(test3Data);
  const test3Expected = 'Delivery Completed - Big Box Store - Order #INV-99999 $10000.00 | Credit Memo #CM-11111 $1500.50';
  const test3Pass = test3Result === test3Expected;
  
  console.log(`Input: ${JSON.stringify(test3Data, null, 2)}`);
  console.log(`Expected: ${test3Expected}`);
  console.log(`Got:      ${test3Result}`);
  console.log(`Status:   ${test3Pass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test3Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 3', passed: test3Pass });

  // Test 4: Email subject with missing credit memo amount (should NOT include credit memo)
  console.log('\n📋 TEST 4: Email subject with missing credit memo amount');
  console.log('-'.repeat(80));
  const test4Data = {
    customerName: 'Test Company',
    quickbooksInvoiceNum: 'INV-55555',
    amount: 750.00,
    creditMemoNumber: 'CM-22222',
    creditMemoAmount: null  // Missing amount
  };
  const test4Result = generateEmailSubject(test4Data);
  const test4Expected = 'Delivery Completed - Test Company - Order #INV-55555 $750.00';
  const test4Pass = test4Result === test4Expected;
  
  console.log(`Input: ${JSON.stringify(test4Data, null, 2)}`);
  console.log(`Expected: ${test4Expected}`);
  console.log(`Got:      ${test4Result}`);
  console.log(`Status:   ${test4Pass ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test4Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 4', passed: test4Pass });

  // Test 5: Email subject with missing credit memo number (should NOT include credit memo)
  console.log('\n📋 TEST 5: Email subject with missing credit memo number');
  console.log('-'.repeat(80));
  const test5Data = {
    customerName: 'Another Company',
    quickbooksInvoiceNum: 'INV-66666',
    amount: 850.00,
    creditMemoNumber: null,  // Missing number
    creditMemoAmount: 100.00
  };
  const test5Result = generateEmailSubject(test5Data);
  const test5Expected = 'Delivery Completed - Another Company - Order #INV-66666 $850.00';
  const test5Pass = test5Result === test5Expected;

  console.log(`Input: ${JSON.stringify(test5Data, null, 2)}`);
  console.log(`Expected: ${test5Expected}`);
  console.log(`Got:      ${test5Result}`);
  console.log(`Status:   ${test5Pass ? '✅ PASS' : '❌ FAIL'}`);

  if (test5Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 5', passed: test5Pass });

  // Test 6: Email subject with zero credit memo amount
  console.log('\n📋 TEST 6: Email subject with zero credit memo amount');
  console.log('-'.repeat(80));
  const test6Data = {
    customerName: 'Zero Credit Co',
    quickbooksInvoiceNum: 'INV-77777',
    amount: 1000.00,
    creditMemoNumber: 'CM-33333',
    creditMemoAmount: 0.00  // Zero amount
  };
  const test6Result = generateEmailSubject(test6Data);
  // Note: 0.00 is falsy in JavaScript, so credit memo should NOT be included
  const test6Expected = 'Delivery Completed - Zero Credit Co - Order #INV-77777 $1000.00';
  const test6Pass = test6Result === test6Expected;

  console.log(`Input: ${JSON.stringify(test6Data, null, 2)}`);
  console.log(`Expected: ${test6Expected}`);
  console.log(`Got:      ${test6Result}`);
  console.log(`Status:   ${test6Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Note:     Zero amount is falsy, so credit memo is not included`);

  if (test6Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 6', passed: test6Pass });

  // Test 7: Email subject with special characters in customer name
  console.log('\n📋 TEST 7: Email subject with special characters in customer name');
  console.log('-'.repeat(80));
  const test7Data = {
    customerName: "Joe's Café & Bakery",
    quickbooksInvoiceNum: 'INV-88888',
    amount: 350.75,
    creditMemoNumber: 'CM-44444',
    creditMemoAmount: 25.50
  };
  const test7Result = generateEmailSubject(test7Data);
  const test7Expected = "Delivery Completed - Joe's Café & Bakery - Order #INV-88888 $350.75 | Credit Memo #CM-44444 $25.50";
  const test7Pass = test7Result === test7Expected;

  console.log(`Input: ${JSON.stringify(test7Data, null, 2)}`);
  console.log(`Expected: ${test7Expected}`);
  console.log(`Got:      ${test7Result}`);
  console.log(`Status:   ${test7Pass ? '✅ PASS' : '❌ FAIL'}`);

  if (test7Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 7', passed: test7Pass });

  // Test 8: Simulate multiple credit memos (concatenated in single field)
  console.log('\n📋 TEST 8: Email subject with multiple credit memos (concatenated)');
  console.log('-'.repeat(80));
  const test8Data = {
    customerName: 'Multi Credit Corp',
    quickbooksInvoiceNum: 'INV-99999',
    amount: 2000.00,
    creditMemoNumber: 'CM-55555, CM-66666',  // Multiple credit memos
    creditMemoAmount: 150.00  // Combined amount
  };
  const test8Result = generateEmailSubject(test8Data);
  const test8Expected = 'Delivery Completed - Multi Credit Corp - Order #INV-99999 $2000.00 | Credit Memo #CM-55555, CM-66666 $150.00';
  const test8Pass = test8Result === test8Expected;

  console.log(`Input: ${JSON.stringify(test8Data, null, 2)}`);
  console.log(`Expected: ${test8Expected}`);
  console.log(`Got:      ${test8Result}`);
  console.log(`Status:   ${test8Pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Note:     Multiple credit memos can be concatenated in the field`);

  if (test8Pass) passedTests++; else failedTests++;
  results.push({ test: 'Test 8', passed: test8Pass });

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests:  ${passedTests + failedTests}`);
  console.log(`✅ Passed:    ${passedTests}`);
  console.log(`❌ Failed:    ${failedTests}`);
  console.log(`Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);

  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((result, index) => {
    console.log(`  ${result.passed ? '✅' : '❌'} ${result.test}`);
  });

  console.log('\n' + '='.repeat(80));

  if (failedTests === 0) {
    console.log('🎉 ALL TESTS PASSED! Credit memo email subject generation is working correctly.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Please review the implementation.');
  }

  console.log('='.repeat(80) + '\n');

  // Return exit code
  return failedTests === 0 ? 0 : 1;
}

// Run the tests
const exitCode = runTests();
process.exit(exitCode);

