// Test script to verify timezone functions work correctly
const { getPSTDate, getPSTDateString, getTodayStartUTC, getTodayEndUTC } = require('./src/lib/timezone.ts');

console.log('=== TIMEZONE FUNCTION TESTS ===');

console.log('\n1. Current time:');
console.log('UTC Now:', new Date().toISOString());
console.log('PST Now (display):', new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));

console.log('\n2. getPSTDate():');
const pstDate = getPSTDate();
console.log('getPSTDate():', pstDate.toISOString());
console.log('Should be same as UTC Now');

console.log('\n3. getPSTDateString():');
const pstDateString = getPSTDateString();
console.log('getPSTDateString():', pstDateString);
console.log('Should be today in YYYY-MM-DD format (PST timezone)');

console.log('\n4. Today range (UTC for database):');
const startUTC = getTodayStartUTC();
const endUTC = getTodayEndUTC();
console.log('Start UTC:', startUTC.toISOString());
console.log('End UTC:', endUTC.toISOString());
console.log('Start PST:', startUTC.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
console.log('End PST:', endUTC.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));

console.log('\n=== TEST COMPLETE ===');
