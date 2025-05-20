const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Seeding database...");

    // Create Administrator user
    const administratorPassword = await argon2.hash("Administrator");

    // Create Administrator user
    const administrator = await prisma.user.upsert({
      where: { username: "Administrator" },
      update: {},
      create: {
        username: "Administrator",
        password: administratorPassword,
        role: "ADMIN",
        fullName: "Administrator",
      },
    });
    console.log("Created Administrator user:", administrator.username);

    // Create test customers
    const customer1 = await prisma.customer.upsert({
      where: { id: "1" },
      update: {},
      create: {
        id: "1",
        name: "ABC Restaurant",
        address: "123 Main St, Anytown, USA",
        contactInfo: "555-123-4567",
        preferences: "Delivery at back door",
        groupCode: "REST",
      },
    });
    console.log("Created customer:", customer1.name);

    const customer2 = await prisma.customer.upsert({
      where: { id: "2" },
      update: {},
      create: {
        id: "2",
        name: "XYZ Cafe",
        address: "456 Oak Ave, Somewhere, USA",
        contactInfo: "555-987-6543",
        preferences: "Call before delivery",
        groupCode: "CAFE",
      },
    });
    console.log("Created customer:", customer2.name);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
