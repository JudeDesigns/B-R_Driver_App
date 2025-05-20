import { PrismaClient, Role } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  // Create Administrator user
  const administratorPassword = await argon2.hash("Administrator");
  await prisma.user.upsert({
    where: { username: "Administrator" },
    update: {},
    create: {
      username: "Administrator",
      password: administratorPassword,
      role: Role.ADMIN,
      fullName: "Administrator",
    },
  });

  // Create sample customers
  const customer1 = await prisma.customer.upsert({
    where: { id: "1" },
    update: {},
    create: {
      id: "1",
      name: "ABC Restaurant",
      address: "123 Main St, Anytown, USA",
      contactInfo: "contact@abcrestaurant.com",
      preferences: "Delivery at back entrance",
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: "2" },
    update: {},
    create: {
      id: "2",
      name: "XYZ Grocery",
      address: "456 Oak Ave, Somewhere, USA",
      contactInfo: "manager@xyzgrocery.com",
      preferences: "Call before delivery",
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
