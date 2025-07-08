require('dotenv').config();

console.log('🔍 ENVIRONMENT CONFIGURATION CHECK');
console.log('==================================\n');

console.log('📋 Current Working Directory:', process.cwd());
console.log('📋 Node Environment:', process.env.NODE_ENV || 'not set');
console.log('📋 Process ID:', process.pid);
console.log('📋 Node Version:', process.version);

console.log('\n📧 EMAIL CONFIGURATION:');
console.log('=======================');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'NOT SET');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'NOT SET');
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE || 'NOT SET');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'NOT SET');
console.log('OFFICE_EMAIL:', process.env.OFFICE_EMAIL || 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***CONFIGURED***' : 'NOT SET');

console.log('\n📁 ENVIRONMENT FILES CHECK:');
console.log('============================');
const fs = require('fs');
const path = require('path');

const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
envFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} - EXISTS (${stats.size} bytes, modified: ${stats.mtime.toISOString()})`);
  } else {
    console.log(`❌ ${file} - NOT FOUND`);
  }
});

console.log('\n🔧 DATABASE CONFIGURATION:');
console.log('===========================');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***CONFIGURED***' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '***CONFIGURED***' : 'NOT SET');

console.log('\n📊 APPLICATION CONFIGURATION:');
console.log('==============================');
console.log('PORT:', process.env.PORT || 'NOT SET');
console.log('NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL || 'NOT SET');

console.log('\n🚀 NEXT.JS ENVIRONMENT LOADING:');
console.log('================================');
console.log('Next.js loads environment variables in this order:');
console.log('1. .env.production.local (if NODE_ENV=production)');
console.log('2. .env.local (always loaded except in test)');
console.log('3. .env.production (if NODE_ENV=production)');
console.log('4. .env');

console.log('\n💡 RECOMMENDATIONS:');
console.log('===================');
if (process.env.NODE_ENV === 'production') {
  console.log('✅ Running in PRODUCTION mode');
  console.log('📝 Use .env.production for production-specific variables');
  console.log('📝 Use .env.local for local overrides (not committed to git)');
} else {
  console.log('⚠️  Not running in production mode');
  console.log('📝 Set NODE_ENV=production for production deployment');
}

if (!process.env.EMAIL_HOST) {
  console.log('❌ EMAIL_HOST not configured - emails will fail');
}

if (!process.env.EMAIL_PASS) {
  console.log('❌ EMAIL_PASS not configured - authentication will fail');
}

console.log('\n🔍 DEBUGGING TIPS:');
console.log('==================');
console.log('1. Check PM2 logs: pm2 logs br-driver-app');
console.log('2. Check application logs for email errors');
console.log('3. Test SMTP directly: node test-gmail-smtp.js');
console.log('4. Restart PM2 after env changes: pm2 restart br-driver-app');
console.log('5. Check server logs: tail -f /var/log/syslog');
