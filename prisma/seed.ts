import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await argon2.hash('admin123');
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  // Create super admin user
  const superAdminPassword = await argon2.hash('superadmin123');
  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      password: superAdminPassword,
      role: Role.SUPER_ADMIN,
    },
  });

  // Create driver user
  const driverPassword = await argon2.hash('driver123');
  await prisma.user.upsert({
    where: { username: 'driver' },
    update: {},
    create: {
      username: 'driver',
      password: driverPassword,
      role: Role.DRIVER,
    },
  });

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      name: 'ABC Restaurant',
      address: '123 Main St, Anytown, USA',
      contactInfo: 'contact@abcrestaurant.com',
      preferences: 'Delivery at back entrance',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: '2' },
    update: {},
    create: {
      id: '2',
      name: 'XYZ Grocery',
      address: '456 Oak Ave, Somewhere, USA',
      contactInfo: 'manager@xyzgrocery.com',
      preferences: 'Call before delivery',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
