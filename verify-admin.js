const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function verifyAdmin() {
    try {
        console.log("Verifying Administrator user...");

        // 1. Find user
        const user = await prisma.user.findUnique({
            where: { username: "Administrator" },
        });

        if (!user) {
            console.error("❌ User 'Administrator' NOT FOUND in database.");
            return;
        }

        console.log("✅ User 'Administrator' found.");
        console.log("   ID:", user.id);
        console.log("   Role:", user.role);
        console.log("   Password Hash:", user.password.substring(0, 20) + "...");

        // 2. Verify password
        const password = "Administrator";
        console.log(`\nVerifying password '${password}'...`);

        let isValid = false;
        if (user.password.startsWith("$argon2")) {
            isValid = await argon2.verify(user.password, password);
        } else {
            isValid = user.password === password;
        }

        if (isValid) {
            console.log("✅ Password verification SUCCESSFUL.");
        } else {
            console.error("❌ Password verification FAILED.");
        }

    } catch (error) {
        console.error("Error during verification:", error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyAdmin();
