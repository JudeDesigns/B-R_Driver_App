#!/usr/bin/env node

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'br-driver-app-jwt-secret-2024-production-key';

function createExpiredToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });
}

console.log('🔍 Testing expired token handling...');

const expiredToken = createExpiredToken({
  id: 'debug-user',
  username: 'debuguser',
  role: 'DRIVER'
});

console.log('Token created:', expiredToken.substring(0, 50) + '...');

const socket = io(BASE_URL, {
  auth: { token: expiredToken, role: 'DRIVER', id: 'debug-user', username: 'debuguser' },
  autoConnect: false
});

socket.on('connect', () => {
  console.log('✅ Connected (unexpected for expired token)');
});

socket.on('auth_error', (error) => {
  console.log('🔍 Received auth_error:', error);
});

socket.on('connect_error', (error) => {
  console.log('🔍 Connect error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔍 Disconnected:', reason);
  process.exit(0);
});

socket.connect();

setTimeout(() => {
  console.log('⏰ Test timeout');
  socket.disconnect();
  process.exit(1);
}, 5000);
