const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if .env file exists
const envPath = path.join(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file not found. Please create a .env file with DATABASE_URL.');
  process.exit(1);
}

try {
  console.log('Running Prisma migration...');
  
  // Generate Prisma client
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Run migration
  console.log('Running database migration...');
  execSync('npx prisma migrate dev --name add-route-upload', { stdio: 'inherit' });
  
  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
