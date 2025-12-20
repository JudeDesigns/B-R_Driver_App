const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // We need to access the property to trigger lazy loading if any, 
    // but usually keys are present. 
    // Actually, Prisma Client properties like 'user', 'vehicle' are getters.
    // So Object.keys might not show them.
    // But checking 'in' operator should work.

    console.log('Checking for systemDocument...');

    if ('systemDocument' in prisma) {
        console.log('✅ systemDocument exists on PrismaClient instance');
    } else {
        console.log('❌ systemDocument DOES NOT exist on PrismaClient instance');
        console.log('Available properties:', Object.getOwnPropertyNames(prisma));
        // Also check prototype
        console.log('Prototype properties:', Object.getOwnPropertyNames(Object.getPrototypeOf(prisma)));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
