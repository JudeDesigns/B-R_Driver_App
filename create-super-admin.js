const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");
const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log("Creating Super Admin user...");

    // Hash the password
    const superAdminPassword = await argon2.hash("SuperAdmin123");

    // Create or update Super Admin user
    const superAdmin = await prisma.user.upsert({
      where: { username: "SuperAdmin" },
      update: {
        role: "SUPER_ADMIN",
        password: superAdminPassword,
      },
      create: {
        username: "SuperAdmin",
        password: superAdminPassword,
        role: "SUPER_ADMIN",
        fullName: "Super Administrator",
      },
    });

    console.log("Created Super Admin user:", superAdmin.username);
    console.log("Login credentials:");
    console.log("Username: SuperAdmin");
    console.log("Password: SuperAdmin123");

    // Also update the existing Administrator to SUPER_ADMIN if needed
    await prisma.user.update({
      where: { username: "Administrator" },
      data: { role: "SUPER_ADMIN" },
    });

    console.log("Updated Administrator role to SUPER_ADMIN");

  } catch (error) {
    console.error("Error creating Super Admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
