
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const driver = await prisma.user.findUnique({
            where: { username: 'Abraham' }
        });
        // Find today's route first
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stops = await prisma.stop.findMany({
            where: {
                route: {
                    date: {
                        gte: today
                    }
                }
            },
            include: {
                route: true,
                customer: true
            }
        });

        console.log(`Found ${stops.length} stops for today (${today.toISOString()}):`);
        stops.forEach(stop => {
            if (stop.customer.name.includes('Benny')) {
                console.log(`*** TARGET STOP ***`);
            }
            console.log(`- Stop ID: ${stop.id}`);
            console.log(`  Customer: ${stop.customer.name}`);
            console.log(`  Status: ${stop.status}`);
            console.log(`  Driver Name (Upload): ${stop.driverNameFromUpload}`);
            console.log(`  Route ID: ${stop.routeId}`);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
