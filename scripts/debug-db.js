
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- USERS ---');
        const users = await prisma.user.findMany();
        users.forEach(u => console.log(`${u.username} (${u.role}) - ID: ${u.id}`));

        console.log('\n--- ROUTES ---');
        const routes = await prisma.route.findMany({
            include: { driver: true, _count: { select: { stops: true } } }
        });
        routes.forEach(r => {
            console.log(`Route ${r.routeNumber} - Date: ${r.date} - Driver: ${r.driver?.username} - Stops: ${r._count.stops}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
