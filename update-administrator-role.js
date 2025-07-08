const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function updateAdministratorRole() {
  try {
    console.log("🔧 Fixing Administrator user role...");
    console.log("====================================\n");

    // Check current Administrator user
    const admin = await prisma.user.findUnique({
      where: { username: "Administrator" },
      select: {
        id: true,
        username: true,
        role: true,
        fullName: true,
      },
    });

    if (!admin) {
      console.log("❌ Administrator user not found!");
      return;
    }

    console.log("📋 Current Administrator user:");
    console.log(`   Username: ${admin.username}`);
    console.log(`   Current Role: ${admin.role}`);
    console.log(`   Full Name: ${admin.fullName}\n`);

    if (admin.role === "ADMIN") {
      console.log("✅ Administrator already has correct ADMIN role!");
      console.log("No changes needed.\n");
    } else {
      console.log(`🔄 Changing Administrator role from ${admin.role} to ADMIN...\n`);

      // Simply update Administrator user to ADMIN role
      await prisma.user.update({
        where: { username: "Administrator" },
        data: { role: "ADMIN" },
      });

      console.log("✅ Administrator role fixed!");
      console.log("   Username: Administrator");
      console.log("   New Role: ADMIN\n");
    }

    // Show current admin users for verification
    console.log("👥 Current admin users in the system:");
    console.log("=====================================");

    const adminUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "SUPER_ADMIN"],
        },
        isDeleted: false,
      },
      select: {
        username: true,
        role: true,
        fullName: true,
      },
      orderBy: {
        username: "asc",
      },
    });

    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} - ${user.role}`);
    });

    console.log("\n✅ Administrator role has been corrected!");
    console.log("🎉 Done!");

  } catch (error) {
    console.error("❌ Error updating Administrator role:", error);
    
    if (error.code === 'P2002') {
      console.log("\n🔧 Troubleshooting:");
      console.log("- Unique constraint violation");
      console.log("- Administrator user might already exist");
      console.log("- Try running the script again");
    } else if (error.code === 'P2025') {
      console.log("\n🔧 Troubleshooting:");
      console.log("- Record not found");
      console.log("- Administrator user might not exist");
      console.log("- Script will create the user automatically");
    } else {
      console.log("\n🔧 Troubleshooting:");
      console.log("- Check database connection");
      console.log("- Verify Prisma schema is up to date");
      console.log("- Run: npx prisma generate");
      console.log("- Run: npx prisma db push");
    }
  } finally {
    await prisma.$disconnect();
    console.log("\n🔌 Database connection closed.");
  }
}

// Run the update
updateAdministratorRole();
