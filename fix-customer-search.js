// Quick fix for customer search NULL isDeleted issue
// Run with: node fix-customer-search.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixCustomerSearch() {
  console.log("🔧 FIXING CUSTOMER SEARCH ISSUE...");
  console.log("=" .repeat(50));

  try {
    await prisma.$connect();
    console.log("✅ Connected to database");

    // 1. Check current state using raw SQL to avoid Prisma validation
    console.log("\n1️⃣ CHECKING CURRENT STATE...");
    
    const currentState = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN "isDeleted" = true THEN 1 END) as deleted_customers,
        COUNT(CASE WHEN "isDeleted" = false THEN 1 END) as active_customers,
        COUNT(CASE WHEN "isDeleted" IS NULL THEN 1 END) as null_customers
      FROM customers
    `;
    
    console.log("📊 Current state:", currentState[0]);
    
    const nullCount = Number(currentState[0].null_customers);
    if (nullCount > 0) {
      console.log(`🚨 Found ${nullCount} customers with NULL isDeleted values`);
      
      // 2. Show sample NULL customers
      const sampleNullCustomers = await prisma.$queryRaw`
        SELECT id, name, "isDeleted" 
        FROM customers 
        WHERE "isDeleted" IS NULL 
        LIMIT 5
      `;
      
      console.log("📋 Sample customers with NULL isDeleted:");
      sampleNullCustomers.forEach((customer, index) => {
        console.log(`   ${index + 1}. ${customer.name} (isDeleted: ${customer.isDeleted})`);
      });
      
      // 3. Fix NULL values
      console.log("\n2️⃣ FIXING NULL VALUES...");
      const updateResult = await prisma.$executeRaw`
        UPDATE customers 
        SET "isDeleted" = false 
        WHERE "isDeleted" IS NULL
      `;
      
      console.log(`✅ Updated ${updateResult} customers (set isDeleted = false)`);
    } else {
      console.log("✅ No NULL isDeleted values found");
    }
    
    // 4. Verify the fix
    console.log("\n3️⃣ VERIFYING FIX...");
    const afterState = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN "isDeleted" = true THEN 1 END) as deleted_customers,
        COUNT(CASE WHEN "isDeleted" = false THEN 1 END) as active_customers,
        COUNT(CASE WHEN "isDeleted" IS NULL THEN 1 END) as null_customers
      FROM customers
    `;
    
    console.log("📊 After fix:", afterState[0]);
    
    // 5. Test Prisma queries now
    console.log("\n4️⃣ TESTING PRISMA QUERIES...");
    try {
      const totalCustomers = await prisma.customer.count();
      const activeCustomers = await prisma.customer.count({
        where: { isDeleted: false }
      });
      
      console.log(`✅ Prisma queries working: ${totalCustomers} total, ${activeCustomers} active`);
      
      // 6. Test search functionality
      console.log("\n5️⃣ TESTING SEARCH FUNCTIONALITY...");
      const sampleCustomers = await prisma.customer.findMany({
        where: { isDeleted: false },
        select: { name: true },
        take: 3,
        orderBy: { name: "asc" }
      });
      
      if (sampleCustomers.length > 0) {
        const testName = sampleCustomers[0].name.substring(0, 3);
        console.log(`🔍 Testing search for "${testName}"...`);
        
        const searchResults = await prisma.customer.findMany({
          where: {
            isDeleted: false,
            name: {
              contains: testName,
              mode: "insensitive",
            },
          },
          select: { name: true },
          take: 5,
        });
        
        console.log(`✅ Search test: Found ${searchResults.length} results`);
        searchResults.forEach((result, index) => {
          console.log(`   ${index + 1}. ${result.name}`);
        });
      }
      
    } catch (error) {
      console.log("❌ Prisma queries still failing:", error.message);
    }
    
    console.log("\n🎉 CUSTOMER SEARCH FIX COMPLETED!");
    console.log("=" .repeat(50));
    console.log("✅ NULL isDeleted values fixed");
    console.log("✅ Prisma queries should work now");
    console.log("✅ Customer search should work in the app");
    console.log("\n🧪 NEXT STEPS:");
    console.log("1. Restart your development server: npm run dev");
    console.log("2. Test customer search in Add Stop modal");
    console.log("3. Check browser console for any remaining errors");
    
  } catch (error) {
    console.error("❌ Fix failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixCustomerSearch();
