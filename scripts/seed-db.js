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

    // Create sample products for testing returns functionality
    const sampleProducts = [
      {
        name: "Fresh Tomatoes",
        sku: "TOMATO-001",
        description: "Fresh red tomatoes, 25 lb case",
        unit: "case",
      },
      {
        name: "Ground Beef",
        sku: "BEEF-001",
        description: "80/20 Ground beef, 10 lb package",
        unit: "package",
      },
      {
        name: "Chicken Breast",
        sku: "CHICKEN-001",
        description: "Boneless chicken breast, 5 lb package",
        unit: "package",
      },
      {
        name: "White Onions",
        sku: "ONION-001",
        description: "White onions, 50 lb bag",
        unit: "bag",
      },
      {
        name: "Lettuce",
        sku: "LETTUCE-001",
        description: "Iceberg lettuce, 24 count case",
        unit: "case",
      },
      {
        name: "Cheddar Cheese",
        sku: "CHEESE-001",
        description: "Sharp cheddar cheese, 5 lb block",
        unit: "block",
      },
      {
        name: "Bread Rolls",
        sku: "BREAD-001",
        description: "Hamburger buns, 8 count package",
        unit: "package",
      },
      {
        name: "Olive Oil",
        sku: "OIL-001",
        description: "Extra virgin olive oil, 1 gallon",
        unit: "gallon",
      },
      {
        name: "Salt",
        sku: "SALT-001",
        description: "Table salt, 26 oz container",
        unit: "container",
      },
      {
        name: "Black Pepper",
        sku: "PEPPER-001",
        description: "Ground black pepper, 16 oz container",
        unit: "container",
      },
    ];

    console.log("Creating sample products...");
    for (const productData of sampleProducts) {
      const product = await prisma.product.upsert({
        where: { sku: productData.sku },
        update: {},
        create: productData,
      });
      console.log(`Created product: ${product.name} (${product.sku})`);
    }

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
