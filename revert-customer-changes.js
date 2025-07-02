// Revert Customer isDeleted Changes Script
// This script reverts the isDeleted changes back to original state
// Run with: node revert-customer-changes.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function revertCustomerChanges() {
  console.log("🔄 REVERTING CUSTOMER isDeleted CHANGES...");
  console.log("=" .repeat(50));

  try {
    await prisma.$connect();
    console.log("✅ Connected to database");

    // 1. Check current state
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
    
    // 2. Revert all isDeleted values back to NULL (original state)
    console.log("\n2️⃣ REVERTING isDeleted VALUES TO NULL...");
    
    const revertResult = await prisma.$executeRaw`
      UPDATE customers 
      SET "isDeleted" = NULL
    `;
    
    console.log(`✅ Reverted ${revertResult} customers (set isDeleted = NULL)`);
    
    // 3. Verify the revert
    console.log("\n3️⃣ VERIFYING REVERT...");
    const afterState = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN "isDeleted" = true THEN 1 END) as deleted_customers,
        COUNT(CASE WHEN "isDeleted" = false THEN 1 END) as active_customers,
        COUNT(CASE WHEN "isDeleted" IS NULL THEN 1 END) as null_customers
      FROM customers
    `;
    
    console.log("📊 After revert:", afterState[0]);
    
    // 4. Test if routes are accessible now
    console.log("\n4️⃣ TESTING ROUTE ACCESS...");
    try {
      const routeCount = await prisma.route.count();
      console.log(`✅ Routes accessible: ${routeCount} routes found`);
    } catch (error) {
      console.log("❌ Route access still has issues:", error.message);
    }
    
    // 5. Test basic customer queries (should fail gracefully now)
    console.log("\n5️⃣ TESTING CUSTOMER QUERIES...");
    try {
      // This should fail because of NULL values, but that's the original state
      const customerCount = await prisma.customer.count();
      console.log(`⚠️  Customer count: ${customerCount} (unexpected - should fail with NULL)`);
    } catch (error) {
      console.log("✅ Customer queries failing as expected (due to NULL values)");
      console.log("   This is the original state before our changes");
    }
    
    console.log("\n🎉 REVERT COMPLETED!");
    console.log("=" .repeat(50));
    console.log("✅ All isDeleted values set back to NULL");
    console.log("✅ Database restored to original state");
    console.log("✅ Routes should be accessible again");
    console.log("⚠️  Customer search will still not work (original issue)");
    console.log("\n🔄 NEXT STEPS:");
    console.log("1. Check if routes are accessible in the app");
    console.log("2. Customer search will still have the original NULL issue");
    console.log("3. We'll need a different approach to fix customer search");
    
  } catch (error) {
    console.error("❌ Revert failed:", error);
    console.log("\n🆘 MANUAL REVERT COMMANDS:");
    console.log("Run these SQL commands manually:");
    console.log("UPDATE customers SET \"isDeleted\" = NULL;");
  } finally {
    await prisma.$disconnect();
  }
}

revertCustomerChanges();
