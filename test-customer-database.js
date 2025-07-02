// Test script to check customer database
// Run this with: node test-customer-database.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testCustomerDatabase() {
  try {
    console.log("🔍 Testing Customer Database...\n");

    // 1. Check total customers
    const totalCustomers = await prisma.customer.count();
    console.log(`📊 Total customers in database: ${totalCustomers}`);

    // 2. Check customers by isDeleted status
    const activeCustomers = await prisma.customer.count({
      where: { isDeleted: false }
    });
    const deletedCustomers = await prisma.customer.count({
      where: { isDeleted: true }
    });
    
    console.log(`✅ Active customers (isDeleted: false): ${activeCustomers}`);
    console.log(`❌ Deleted customers (isDeleted: true): ${deletedCustomers}`);

    // 3. Check for null isDeleted values
    const nullDeletedCustomers = await prisma.customer.count({
      where: { isDeleted: null }
    });
    console.log(`❓ Customers with null isDeleted: ${nullDeletedCustomers}\n`);

    // 4. Show first 10 customers with their isDeleted status
    console.log("📋 First 10 customers:");
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isDeleted: true,
      },
      take: 10,
      orderBy: { name: "asc" }
    });

    customers.forEach((customer, index) => {
      const status = customer.isDeleted === null ? "NULL" : (customer.isDeleted ? "DELETED" : "ACTIVE");
      console.log(`   ${index + 1}. ${customer.name} - Status: ${status}`);
      if (customer.email) console.log(`      Email: ${customer.email}`);
      if (customer.phone) console.log(`      Phone: ${customer.phone}`);
      console.log("");
    });

    // 5. Test search functionality with a real customer name
    if (customers.length > 0) {
      const testCustomer = customers.find(c => !c.isDeleted) || customers[0];
      const searchTerm = testCustomer.name.substring(0, 3).toLowerCase();
      
      console.log(`🔍 Testing search with "${searchTerm}" (from customer: ${testCustomer.name}):`);
      
      const searchResults = await prisma.customer.findMany({
        where: {
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
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          isDeleted: true,
        },
        take: 5,
      });

      console.log(`   Found ${searchResults.length} results:`);
      searchResults.forEach((result, index) => {
        const status = result.isDeleted === null ? "NULL" : (result.isDeleted ? "DELETED" : "ACTIVE");
        console.log(`   ${index + 1}. ${result.name} - Status: ${status}`);
      });

      // Filter to active only
      const activeResults = searchResults.filter(r => !r.isDeleted);
      console.log(`   Active results: ${activeResults.length}`);
    }

    console.log("\n✅ Customer database test completed!");
    console.log("\n💡 If you see customers but search isn't working:");
    console.log("   1. Check if customers have isDeleted: false");
    console.log("   2. Try the search API directly in browser");
    console.log("   3. Check browser network tab for API calls");

  } catch (error) {
    console.error("❌ Error testing customer database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testCustomerDatabase();
