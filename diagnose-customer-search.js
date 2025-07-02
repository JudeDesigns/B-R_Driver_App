// Comprehensive Customer Search Diagnostic Script
// Run with: node diagnose-customer-search.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function diagnoseCustomerSearch() {
  console.log("🔍 COMPREHENSIVE CUSTOMER SEARCH DIAGNOSIS");
  console.log("=" .repeat(60));

  try {
    // 1. DATABASE CONNECTION TEST
    console.log("\n1️⃣ TESTING DATABASE CONNECTION...");
    await prisma.$connect();
    console.log("✅ Database connection successful");

    // 2. CUSTOMER TABLE EXISTENCE
    console.log("\n2️⃣ CHECKING CUSTOMER TABLE...");
    try {
      const tableExists = await prisma.customer.findFirst();
      console.log("✅ Customer table exists and accessible");
    } catch (error) {
      console.log("❌ Customer table issue:", error.message);
      return;
    }

    // 3. CUSTOMER COUNT ANALYSIS
    console.log("\n3️⃣ ANALYZING CUSTOMER DATA...");
    const totalCustomers = await prisma.customer.count();
    const activeCustomers = await prisma.customer.count({
      where: { isDeleted: false }
    });
    const deletedCustomers = await prisma.customer.count({
      where: { isDeleted: true }
    });
    const nullDeletedCustomers = await prisma.customer.count({
      where: { isDeleted: null }
    });

    console.log(`📊 Total customers: ${totalCustomers}`);
    console.log(`✅ Active customers (isDeleted: false): ${activeCustomers}`);
    console.log(`❌ Deleted customers (isDeleted: true): ${deletedCustomers}`);
    console.log(`❓ Null isDeleted customers: ${nullDeletedCustomers}`);

    if (totalCustomers === 0) {
      console.log("🚨 CRITICAL: No customers exist in database!");
      console.log("   Solution: Import customers or create test data");
      return;
    }

    if (activeCustomers === 0) {
      console.log("🚨 CRITICAL: All customers are marked as deleted!");
      console.log("   Solution: Update customers set isDeleted = false");
      
      // Show sample deleted customers
      const sampleDeleted = await prisma.customer.findMany({
        where: { isDeleted: true },
        select: { name: true, isDeleted: true },
        take: 5
      });
      console.log("   Sample deleted customers:", sampleDeleted);
      return;
    }

    // 4. SAMPLE ACTIVE CUSTOMERS
    console.log("\n4️⃣ SAMPLE ACTIVE CUSTOMERS...");
    const sampleCustomers = await prisma.customer.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        groupCode: true,
        isDeleted: true
      },
      take: 10,
      orderBy: { name: "asc" }
    });

    console.log("📋 Active customers found:");
    sampleCustomers.forEach((customer, index) => {
      console.log(`   ${index + 1}. "${customer.name}" (ID: ${customer.id.substring(0, 8)}...)`);
      if (customer.email) console.log(`      Email: ${customer.email}`);
      if (customer.phone) console.log(`      Phone: ${customer.phone}`);
      if (customer.groupCode) console.log(`      Group: ${customer.groupCode}`);
    });

    // 5. SEARCH FUNCTIONALITY TEST
    console.log("\n5️⃣ TESTING SEARCH FUNCTIONALITY...");
    if (sampleCustomers.length > 0) {
      const testCustomer = sampleCustomers[0];
      const searchTerms = [
        testCustomer.name.substring(0, 3).toLowerCase(),
        testCustomer.name.substring(0, 2).toLowerCase(),
        testCustomer.name.toLowerCase(),
      ];

      for (const searchTerm of searchTerms) {
        console.log(`\n🔍 Testing search for "${searchTerm}":`);
        
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
            name: true,
            email: true,
          },
          take: 5,
        });

        console.log(`   Found ${searchResults.length} results:`);
        searchResults.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.name}`);
        });

        if (searchResults.length === 0) {
          console.log("   ❌ No results found - this indicates search logic issue");
        }
      }
    }

    // 6. RECOMMENDATIONS
    console.log("\n6️⃣ DIAGNOSIS SUMMARY & RECOMMENDATIONS:");
    console.log("=" .repeat(50));
    
    if (activeCustomers > 0) {
      console.log("✅ Database has active customers");
      console.log("✅ Search logic should work");
      console.log("\n🔍 LIKELY ISSUES:");
      console.log("   1. Authentication token expired/invalid");
      console.log("   2. API route not accessible");
      console.log("   3. Network/CORS issues");
      console.log("   4. Frontend not calling API correctly");
      
      console.log("\n🛠️  NEXT STEPS:");
      console.log("   1. Check browser Network tab for API calls");
      console.log("   2. Check server console for API logs");
      console.log("   3. Test API directly: /api/admin/customers/search?q=test");
      console.log("   4. Verify authentication token in localStorage");
    }

  } catch (error) {
    console.error("❌ Diagnosis failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseCustomerSearch();
