/**
 * Mock Attendance API Server for Testing
 *
 * This is a simple HTTP server that mocks the external attendance application API.
 * Use this for testing the attendance integration without needing the actual attendance app.
 *
 * Usage:
 *   node test-attendance-api.js
 *
 * Then update .env:
 *   ATTENDANCE_API_URL=http://localhost:4000/api
 *   ATTENDANCE_API_KEY=test-key-123
 */

const http = require('http');
const PORT = 4000;

// Mock data - configure these to test different scenarios
const MOCK_CONFIG = {
  // Set to true to simulate driver clocked in, false for not clocked in
  isClockedIn: true,

  // Set to true to simulate API errors
  simulateError: false,

  // Set to true to simulate slow responses
  simulateSlowResponse: false,

  // Delay in milliseconds for slow responses
  responseDelay: 3000,
};

// Mock database of clocked-in users
const clockedInUsers = new Set([
  'Driver1', // Example: Driver1 is clocked in
  'Driver2', // Example: Driver2 is clocked in
  // Add more usernames as needed
]);

// Helper to parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

// Helper to send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const { method, url, headers } = req;

  console.log(`\n[Mock Attendance API] ${method} ${url}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // POST /api/attendance/status
    if (method === 'POST' && url === '/api/attendance/status') {
      // Simulate slow response if configured
      if (MOCK_CONFIG.simulateSlowResponse) {
        console.log(`[Mock Attendance API] Simulating slow response (${MOCK_CONFIG.responseDelay}ms)...`);
        await new Promise(resolve => setTimeout(resolve, MOCK_CONFIG.responseDelay));
      }

      // Simulate error if configured
      if (MOCK_CONFIG.simulateError) {
        console.log('[Mock Attendance API] Simulating error response');
        return sendJSON(res, 500, {
          error: 'Internal Server Error',
          message: 'Simulated error for testing',
        });
      }

      // Verify authorization header
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[Mock Attendance API] Missing or invalid authorization header');
        return sendJSON(res, 401, {
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
      }

      const body = await parseBody(req);
      const { userId, username } = body;

      if (!userId || !username) {
        console.log('[Mock Attendance API] Missing userId or username');
        return sendJSON(res, 400, {
          error: 'Bad Request',
          message: 'userId and username are required',
        });
      }

      // Check if user is clocked in
      const isClockedIn = MOCK_CONFIG.isClockedIn || clockedInUsers.has(username);

      const response = {
        isClockedIn,
        clockInTime: isClockedIn ? new Date().toISOString() : null,
        userId,
        username,
      };

      console.log('[Mock Attendance API] Sending response:', response);
      return sendJSON(res, 200, response);
    }

    // GET /api/health
    if (method === 'GET' && url === '/api/health') {
      return sendJSON(res, 200, {
        status: 'ok',
        timestamp: new Date().toISOString(),
        config: MOCK_CONFIG,
      });
    }

    // POST /api/config
    if (method === 'POST' && url === '/api/config') {
      const body = await parseBody(req);
      const { isClockedIn, simulateError, simulateSlowResponse, responseDelay } = body;

      if (isClockedIn !== undefined) MOCK_CONFIG.isClockedIn = isClockedIn;
      if (simulateError !== undefined) MOCK_CONFIG.simulateError = simulateError;
      if (simulateSlowResponse !== undefined) MOCK_CONFIG.simulateSlowResponse = simulateSlowResponse;
      if (responseDelay !== undefined) MOCK_CONFIG.responseDelay = responseDelay;

      console.log('[Mock Attendance API] Configuration updated:', MOCK_CONFIG);

      return sendJSON(res, 200, {
        message: 'Configuration updated',
        config: MOCK_CONFIG,
      });
    }

    // 404 Not Found
    sendJSON(res, 404, { error: 'Not Found' });
  } catch (error) {
    console.error('[Mock Attendance API] Error:', error);
    sendJSON(res, 500, { error: 'Internal Server Error', message: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log('\n===========================================');
  console.log('🚀 Mock Attendance API Server Started');
  console.log('===========================================');
  console.log(`Port: ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Attendance Status: POST http://localhost:${PORT}/api/attendance/status`);
  console.log(`Update Config: POST http://localhost:${PORT}/api/config`);
  console.log('\nCurrent Configuration:');
  console.log(JSON.stringify(MOCK_CONFIG, null, 2));
  console.log('\nClocked In Users:');
  console.log(Array.from(clockedInUsers));
  console.log('===========================================\n');
  console.log('💡 To change configuration, send POST to /api/config:');
  console.log('   curl -X POST http://localhost:4000/api/config \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"isClockedIn": false}\'');
  console.log('\n===========================================\n');
});

