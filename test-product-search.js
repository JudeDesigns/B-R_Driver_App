// Test script to verify product search functionality
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function testProductSearch() {
  try {
    console.log("Testing product search functionality...");

    // First, let's check if there are any products in the database
    const productCount = await prisma.product.count({
      where: { isDeleted: false }
    });
    
    console.log(`Found ${productCount} products in database`);

    if (productCount === 0) {
      console.log("No products found. Adding sample products...");
      
      // Add sample products
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
        }
      ];

      for (const productData of sampleProducts) {
        try {
          const product = await prisma.product.create({
            data: productData,
          });
          console.log(`✓ Created product: ${product.name} (${product.sku})`);
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`- Product ${productData.sku} already exists, skipping...`);
          } else {
            console.error(`Error creating product ${productData.sku}:`, error.message);
          }
        }
      }
    }

    // Test search functionality
    console.log("\nTesting search functionality:");
    
    const searchTerms = ["tom", "beef", "chicken", "ONION"];
    
    for (const term of searchTerms) {
      console.log(`\nSearching for: "${term}"`);
      
      const results = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
          ],
          isDeleted: false,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          unit: true,
        },
        take: 20,
      });
      
      console.log(`Found ${results.length} results:`);
      results.forEach(product => {
        console.log(`  - ${product.name} (${product.sku}) - ${product.unit || 'N/A'}`);
      });
    }

    console.log("\n✅ Product search test completed successfully!");
    
  } catch (error) {
    console.error("❌ Error testing product search:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testProductSearch();
