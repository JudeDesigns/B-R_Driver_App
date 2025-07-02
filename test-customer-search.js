// Test script to debug customer search
// Run this with: node test-customer-search.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testCustomerSearch() {
  try {
    console.log("🔍 Testing Customer Search...\n");

    // 1. Check if customers exist
    console.log("1. Checking total customers in database:");
    const totalCustomers = await prisma.customer.count({
      where: { isDeleted: false }
    });
    console.log(`   Total customers: ${totalCustomers}\n`);

    // 2. Show first 10 customers
    console.log("2. First 10 customers:");
    const customers = await prisma.customer.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        groupCode: true,
      },
      take: 10,
      orderBy: { name: "asc" }
    });

    if (customers.length === 0) {
      console.log("   ❌ No customers found in database!");
      console.log("   This is why search isn't working.\n");
    } else {
      customers.forEach((customer, index) => {
        console.log(`   ${index + 1}. ${customer.name} (ID: ${customer.id})`);
        if (customer.email) console.log(`      Email: ${customer.email}`);
        if (customer.phone) console.log(`      Phone: ${customer.phone}`);
        if (customer.groupCode) console.log(`      Group: ${customer.groupCode}`);
        console.log("");
      });
    }

    // 3. Test search functionality
    if (customers.length > 0) {
      const testName = customers[0].name;
      const searchTerm = testName.substring(0, 3); // First 3 characters
      
      console.log(`3. Testing search with "${searchTerm}":`);
      
      const searchResults = await prisma.customer.findMany({
        where: {
          isDeleted: false,
          OR: [
            {
              name: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
            {
              groupCode: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          groupCode: true,
        },
        take: 20,
      });

      console.log(`   Found ${searchResults.length} results:`);
      searchResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.name}`);
      });
    }

    console.log("\n✅ Customer search test completed!");

  } catch (error) {
    console.error("❌ Error testing customer search:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testCustomerSearch();
