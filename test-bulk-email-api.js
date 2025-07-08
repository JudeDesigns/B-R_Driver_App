// Test script for bulk email API
const fetch = require('node-fetch');

async function testBulkEmailAPI() {
  console.log('🧪 TESTING BULK EMAIL API');
  console.log('=========================\n');

  // You'll need to replace these with actual values
  const BASE_URL = 'http://localhost:3000'; // or your server URL
  const ROUTE_ID = 'your-route-id-here'; // Replace with actual route ID
  const TOKEN = 'your-admin-token-here'; // Replace with actual admin token

  console.log('📋 Test Configuration:');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Route ID: ${ROUTE_ID}`);
  console.log(`Token: ${TOKEN ? '***PROVIDED***' : 'NOT SET'}\n`);

  if (!TOKEN || TOKEN === 'your-admin-token-here') {
    console.log('❌ Please update the TOKEN variable with a valid admin token');
    console.log('💡 You can get a token by logging in as admin and checking localStorage');
    return;
  }

  if (!ROUTE_ID || ROUTE_ID === 'your-route-id-here') {
    console.log('❌ Please update the ROUTE_ID variable with a valid route ID');
    console.log('💡 You can get a route ID from the admin routes page URL');
    return;
  }

  try {
    console.log('📧 Sending bulk email request...');
    
    const response = await fetch(`${BASE_URL}/api/admin/routes/${ROUTE_ID}/send-emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
    });

    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📊 Response Headers:`, response.headers.raw());

    const contentType = response.headers.get('content-type');
    console.log(`📊 Content-Type: ${contentType}`);

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('\n✅ JSON Response Received:');
      console.log(JSON.stringify(data, null, 2));

      if (data.success) {
        console.log('\n🎉 SUCCESS!');
        console.log(`📧 ${data.summary}`);
        if (data.results) {
          console.log(`📊 Total: ${data.results.total}`);
          console.log(`✅ Sent: ${data.results.sent}`);
          console.log(`❌ Failed: ${data.results.failed}`);
        }
      } else {
        console.log('\n⚠️ API returned error:');
        console.log(`❌ ${data.message}`);
      }
    } else {
      const textResponse = await response.text();
      console.log('\n❌ NON-JSON Response Received:');
      console.log(textResponse.substring(0, 500));
      console.log('\n🔧 This indicates a server error or routing issue');
    }

  } catch (error) {
    console.error('\n❌ Request Failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('🔧 Server appears to be down. Make sure the app is running.');
    } else if (error.message.includes('JSON')) {
      console.log('🔧 Server returned invalid JSON. Check server logs.');
    }
  }

  console.log('\n📝 DEBUGGING TIPS:');
  console.log('==================');
  console.log('1. Check PM2 logs: pm2 logs br-driver-app');
  console.log('2. Verify route has completed stops');
  console.log('3. Check admin token is valid');
  console.log('4. Ensure server is running on correct port');
  console.log('5. Check network connectivity');
}

// Instructions for getting the required values
console.log('📋 SETUP INSTRUCTIONS:');
console.log('======================');
console.log('1. Open your browser and login as admin');
console.log('2. Go to a route details page');
console.log('3. Copy the route ID from the URL');
console.log('4. Open browser dev tools → Application → Local Storage');
console.log('5. Copy the "token" value');
console.log('6. Update the TOKEN and ROUTE_ID variables in this script');
console.log('7. Run: node test-bulk-email-api.js\n');

// Run the test
testBulkEmailAPI();
