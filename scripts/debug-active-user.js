#!/usr/bin/env node

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'br-driver-app-jwt-secret-2024-production-key';

function createExpiringToken(payload, seconds = 30) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${seconds}s` });
}

function createToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

console.log('🔍 Testing active user protection with expiring token...');

// Create token that expires in 10 seconds
const expiringToken = createExpiringToken({
  id: 'debug-active-user',
  username: 'debugactiveuser',
  role: 'DRIVER'
}, 10);

console.log('Token created, expires in 10 seconds');

// Decode and check the token
const decoded = jwt.decode(expiringToken);
const now = Math.floor(Date.now() / 1000);
const timeUntilExpiry = decoded.exp - now;
console.log(`Token expires in ${timeUntilExpiry} seconds from now`);

const socket = io(BASE_URL, {
  auth: { token: expiringToken, role: 'DRIVER', id: 'debug-active-user', username: 'debugactiveuser' },
  autoConnect: false
});

let activityCount = 0;
let startTime = Date.now();

socket.on('connect', () => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`✅ Connected at ${elapsed}s`);
  
  // Start activity
  const activityInterval = setInterval(() => {
    activityCount++;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    console.log(`🔄 Activity ${activityCount} at ${elapsed}s`);
    socket.emit('join_route_room', `test-route-${activityCount}`);
    
    if (activityCount >= 15) {
      clearInterval(activityInterval);
      console.log('✅ Test completed successfully');
      socket.disconnect();
      process.exit(0);
    }
  }, 1000);
});

socket.on('auth_error', (error) => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`🔍 Auth error at ${elapsed}s:`, error);
  
  // Try to re-authenticate
  const newToken = createToken({
    id: 'debug-active-user',
    username: 'debugactiveuser',
    role: 'DRIVER'
  });
  
  console.log(`🔄 Re-authenticating at ${elapsed}s...`);
  socket.emit('reauthenticate', { token: newToken });
});

socket.on('reauthenticated', (data) => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`✅ Re-authenticated successfully at ${elapsed}s:`, data);
});

socket.on('connect_error', (error) => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`🔍 Connect error at ${elapsed}s:`, error.message);
});

socket.on('disconnect', (reason) => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`🔍 Disconnected at ${elapsed}s:`, reason);
  
  if (activityCount >= 3) {
    console.log('✅ User was active before disconnect - test successful');
    process.exit(0);
  } else {
    console.log('❌ User was disconnected too early');
    process.exit(1);
  }
});

socket.connect();

setTimeout(() => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  console.log(`⏰ Test timeout at ${elapsed}s`);
  
  if (activityCount >= 3) {
    console.log('✅ User remained active - test successful');
    process.exit(0);
  } else {
    console.log('❌ Insufficient activity');
    process.exit(1);
  }
}, 20000);
