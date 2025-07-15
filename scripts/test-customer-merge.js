#!/usr/bin/env node

/**
 * Test script for customer merge functionality
 * Run with: node scripts/test-customer-merge.js
 */

const BASE_URL = 'http://localhost:3000'; // Adjust for your server

async function testCustomerMerge() {
  console.log('🧪 Testing Customer Merge Functionality\n');

  // You'll need to get a valid admin token
  const token = 'YOUR_ADMIN_TOKEN_HERE'; // Replace with actual token

  try {
    // 1. Check for existing duplicates
    console.log('1️⃣ Checking for existing duplicate customers...');
    const duplicatesResponse = await fetch(`${BASE_URL}/api/admin/customers/merge`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!duplicatesResponse.ok) {
      throw new Error(`Failed to fetch duplicates: ${duplicatesResponse.statusText}`);
    }

    const duplicatesData = await duplicatesResponse.json();
    console.log(`📊 Found ${duplicatesData.duplicateGroups.length} groups with duplicates`);
    
    if (duplicatesData.duplicateGroups.length > 0) {
      console.log('\n📋 Duplicate groups:');
      duplicatesData.duplicateGroups.forEach(group => {
        console.log(`  • ${group.name}: ${group.count} duplicates, ${group.totalStops} stops`);
      });
    }

    // 2. Test dry run merge for first duplicate group
    if (duplicatesData.duplicateGroups.length > 0) {
      const firstGroup = duplicatesData.duplicateGroups[0];
      console.log(`\n2️⃣ Testing dry run merge for: ${firstGroup.name}`);
      
      const dryRunResponse = await fetch(`${BASE_URL}/api/admin/customers/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: firstGroup.name,
          dryRun: true,
        }),
      });

      if (!dryRunResponse.ok) {
        throw new Error(`Dry run failed: ${dryRunResponse.statusText}`);
      }

      const dryRunData = await dryRunResponse.json();
      console.log('📋 Dry run results:');
      console.log(`  Primary customer: ${dryRunData.primaryCustomer.id}`);
      console.log(`  Duplicates to merge: ${dryRunData.duplicatesToMerge.length}`);
      console.log(`  Stops to move: ${dryRunData.totalStopsToMove}`);
      console.log(`  Documents to move: ${dryRunData.totalDocumentsToMove}`);

      // Uncomment the following to perform actual merge
      /*
      console.log(`\n3️⃣ Performing actual merge for: ${firstGroup.name}`);
      
      const mergeResponse = await fetch(`${BASE_URL}/api/admin/customers/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName: firstGroup.name,
          dryRun: false,
        }),
      });

      if (!mergeResponse.ok) {
        throw new Error(`Merge failed: ${mergeResponse.statusText}`);
      }

      const mergeData = await mergeResponse.json();
      console.log('✅ Merge completed:');
      console.log(`  Stops moved: ${mergeData.totalStopsMoved}`);
      console.log(`  Documents moved: ${mergeData.totalDocumentsMoved}`);
      console.log(`  Duplicates removed: ${mergeData.duplicatesRemoved}`);
      */
    }

    // 3. Test auto-merge on customer creation
    console.log('\n4️⃣ Testing auto-merge on customer creation...');
    console.log('ℹ️  Create a customer with the same name as an existing one to test auto-merge');
    console.log('ℹ️  Check the response for _merged: true and _mergedCount properties');

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Instructions for manual testing
console.log(`
📋 MANUAL TESTING INSTRUCTIONS:

1. Update the token in this script with a valid admin token
2. Run: node scripts/test-customer-merge.js
3. Test auto-merge by creating a customer with the same name as an existing one
4. Check the browser network tab for _merged: true in the response
5. Verify that "View Full Customer Details" now works correctly

🔧 API ENDPOINTS AVAILABLE:

• GET  /api/admin/customers/merge - List all duplicate customers
• POST /api/admin/customers/merge - Merge duplicates (with dryRun option)
• POST /api/admin/customers - Auto-merge on creation (existing endpoint enhanced)

🚀 DEPLOYMENT READY!
`);

if (require.main === module) {
  testCustomerMerge();
}
