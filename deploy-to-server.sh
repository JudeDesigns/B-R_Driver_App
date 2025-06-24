# Navigate to your application directory
cd /path/to/your/B-R_Driver_App

# Create and run the SuperAdmin creation script
node -e "
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();

(async () => {
  try {
    // Hash the password using argon2
    const hashedPassword = await argon2.hash('SuperAdmin123!');
    
    // Create the super admin user
    const user = await prisma.user.create({
      data: {
        username: 'SuperAdmin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        fullName: 'Super Administrator',
      },
    });
    
    console.log('✅ SuperAdmin created successfully!');
    console.log('Username:', user.username);
    console.log('Role:', user.role);
    console.log('ID:', user.id);
    
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('❌ Username already exists. Try a different username.');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await prisma.\$disconnect();
  }
})();
"