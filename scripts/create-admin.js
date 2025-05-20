const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Check if the Administrator user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'Administrator' },
    });

    if (existingAdmin) {
      console.log('Administrator user already exists.');
      return;
    }

    // Hash the password
    const hashedPassword = await argon2.hash('Administrator');

    // Create the Administrator user
    const admin = await prisma.user.create({
      data: {
        username: 'Administrator',
        password: hashedPassword,
        role: 'ADMIN',
        fullName: 'Administrator',
      },
    });

    console.log('Administrator user created successfully:', admin.id);
  } catch (error) {
    console.error('Error creating Administrator user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
