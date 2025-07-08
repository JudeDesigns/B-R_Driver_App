const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function analyzeUsersAndRoles() {
  try {
    console.log("🔍 ANALYZING USERS AND ROLES");
    console.log("============================\n");

    // Get all users in the system
    const allUsers = await prisma.user.findMany({
      where: {
        isDeleted: false,
      },
      select: {
        id: true,
        username: true,
        role: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    console.log(`📊 Total Users Found: ${allUsers.length}\n`);

    if (allUsers.length === 0) {
      console.log("❌ No users found in the system!");
      return;
    }

    // Categorize users by role
    const usersByRole = {
      ADMIN: [],
      SUPER_ADMIN: [],
      DRIVER: [],
    };

    allUsers.forEach(user => {
      if (usersByRole[user.role]) {
        usersByRole[user.role].push(user);
      }
    });

    // Display users by role
    console.log("👥 USERS BY ROLE:");
    console.log("=================\n");

    // SUPER_ADMIN users
    console.log("🔴 SUPER_ADMIN Users:");
    if (usersByRole.SUPER_ADMIN.length === 0) {
      console.log("   No SUPER_ADMIN users found\n");
    } else {
      usersByRole.SUPER_ADMIN.forEach((user, index) => {
        console.log(`   ${index + 1}. Username: ${user.username}`);
        console.log(`      Full Name: ${user.fullName || 'N/A'}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Created: ${user.createdAt}`);
        console.log(`      Updated: ${user.updatedAt}`);
        console.log("");
      });
    }

    // ADMIN users
    console.log("🟡 ADMIN Users:");
    if (usersByRole.ADMIN.length === 0) {
      console.log("   No ADMIN users found\n");
    } else {
      usersByRole.ADMIN.forEach((user, index) => {
        console.log(`   ${index + 1}. Username: ${user.username}`);
        console.log(`      Full Name: ${user.fullName || 'N/A'}`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Created: ${user.createdAt}`);
        console.log(`      Updated: ${user.updatedAt}`);
        console.log("");
      });
    }

    // DRIVER users
    console.log("🟢 DRIVER Users:");
    if (usersByRole.DRIVER.length === 0) {
      console.log("   No DRIVER users found\n");
    } else {
      console.log(`   Found ${usersByRole.DRIVER.length} driver(s):`);
      usersByRole.DRIVER.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.username} (${user.fullName || 'N/A'})`);
      });
      console.log("");
    }

    // Focus on Administrator user specifically
    console.log("🎯 ADMINISTRATOR USER ANALYSIS:");
    console.log("===============================\n");

    const administratorUser = allUsers.find(user => user.username === "Administrator");
    
    if (!administratorUser) {
      console.log("❌ Administrator user NOT FOUND!");
      console.log("   This user needs to be created.\n");
    } else {
      console.log("✅ Administrator user FOUND:");
      console.log(`   Username: ${administratorUser.username}`);
      console.log(`   Current Role: ${administratorUser.role}`);
      console.log(`   Full Name: ${administratorUser.fullName || 'N/A'}`);
      console.log(`   ID: ${administratorUser.id}`);
      console.log(`   Created: ${administratorUser.createdAt}`);
      console.log(`   Updated: ${administratorUser.updatedAt}\n`);

      if (administratorUser.role === "SUPER_ADMIN") {
        console.log("⚠️  ISSUE IDENTIFIED:");
        console.log("   Administrator user currently has SUPER_ADMIN role");
        console.log("   This should be changed to ADMIN role\n");
      } else if (administratorUser.role === "ADMIN") {
        console.log("✅ Administrator user has correct ADMIN role\n");
      } else {
        console.log(`⚠️  UNEXPECTED ROLE: ${administratorUser.role}`);
        console.log("   Administrator should have ADMIN role\n");
      }
    }

    // Check for SuperAdmin user
    console.log("🎯 SUPERADMIN USER ANALYSIS:");
    console.log("============================\n");

    const superAdminUser = allUsers.find(user => user.username === "SuperAdmin");
    
    if (!superAdminUser) {
      console.log("❌ SuperAdmin user NOT FOUND!");
      console.log("   This user should exist for super admin operations.\n");
    } else {
      console.log("✅ SuperAdmin user FOUND:");
      console.log(`   Username: ${superAdminUser.username}`);
      console.log(`   Current Role: ${superAdminUser.role}`);
      console.log(`   Full Name: ${superAdminUser.fullName || 'N/A'}`);
      console.log(`   ID: ${superAdminUser.id}`);
      console.log(`   Created: ${superAdminUser.createdAt}`);
      console.log(`   Updated: ${superAdminUser.updatedAt}\n`);

      if (superAdminUser.role === "SUPER_ADMIN") {
        console.log("✅ SuperAdmin user has correct SUPER_ADMIN role\n");
      } else {
        console.log(`⚠️  ISSUE: SuperAdmin user has ${superAdminUser.role} role`);
        console.log("   This should be SUPER_ADMIN role\n");
      }
    }

    // Summary and recommendations
    console.log("📋 SUMMARY AND RECOMMENDATIONS:");
    console.log("===============================\n");

    const issues = [];
    const recommendations = [];

    // Check Administrator user
    if (!administratorUser) {
      issues.push("Administrator user does not exist");
      recommendations.push("Create Administrator user with ADMIN role");
    } else if (administratorUser.role !== "ADMIN") {
      issues.push(`Administrator user has ${administratorUser.role} role instead of ADMIN`);
      recommendations.push("Change Administrator user role to ADMIN");
    }

    // Check SuperAdmin user
    if (!superAdminUser) {
      issues.push("SuperAdmin user does not exist");
      recommendations.push("Create SuperAdmin user with SUPER_ADMIN role");
    } else if (superAdminUser.role !== "SUPER_ADMIN") {
      issues.push(`SuperAdmin user has ${superAdminUser.role} role instead of SUPER_ADMIN`);
      recommendations.push("Change SuperAdmin user role to SUPER_ADMIN");
    }

    // Check for multiple SUPER_ADMIN users
    if (usersByRole.SUPER_ADMIN.length > 1) {
      issues.push(`Multiple SUPER_ADMIN users found (${usersByRole.SUPER_ADMIN.length})`);
      recommendations.push("Review and ensure only necessary users have SUPER_ADMIN role");
    }

    if (issues.length === 0) {
      console.log("✅ No issues found! User roles are correctly configured.\n");
    } else {
      console.log("⚠️  Issues Found:");
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      console.log("");

      console.log("🔧 Recommendations:");
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
      console.log("");
    }

    console.log("🎯 NEXT STEPS:");
    console.log("==============");
    console.log("Based on the analysis above, I can create a specific script to fix any identified issues.");
    console.log("Please review the findings and let me know what changes you'd like to make.\n");

  } catch (error) {
    console.error("❌ Error analyzing users and roles:", error);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Database connection closed.");
  }
}

// Run the analysis
analyzeUsersAndRoles();
