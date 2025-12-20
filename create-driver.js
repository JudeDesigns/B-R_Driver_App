const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function createDriver() {
    try {
        console.log("Creating Test Driver...");

        const password = await argon2.hash("driver123");

        const driver = await prisma.user.upsert({
            where: { username: "driver" },
            update: {
                password: password, // Update password just in case
                role: "DRIVER"
            },
            create: {
                username: "driver",
                password: password,
                role: "DRIVER",
                fullName: "Test Driver",
            },
        });

        console.log("✅ Driver created/updated:");
        console.log("   Username: driver");
        console.log("   Password: driver123");
        console.log("   ID:", driver.id);

    } catch (error) {
        console.error("Error creating driver:", error);
    } finally {
        await prisma.$disconnect();
    }
}

createDriver();
