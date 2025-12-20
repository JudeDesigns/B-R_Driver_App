
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        console.log(`Calculating stats for: ${today.toISOString()} to ${tomorrow.toISOString()}`);

        // 1. Routes Stats
        const routes = await prisma.route.findMany({
            where: {
                date: {
                    gte: today,
                    lt: tomorrow
                }
            },
            include: {
                stops: true
            }
        });

        const routeStats = {
            total: routes.length,
            PENDING: routes.filter(r => r.status === 'PENDING').length,
            IN_PROGRESS: routes.filter(r => r.status === 'IN_PROGRESS').length,
            COMPLETED: routes.filter(r => r.status === 'COMPLETED').length,
            CANCELLED: routes.filter(r => r.status === 'CANCELLED').length,
        };

        // 2. Stops Stats
        let totalStops = 0;
        const stopStats = {
            PENDING: 0,
            ON_THE_WAY: 0,
            ARRIVED: 0,
            COMPLETED: 0,
            CANCELLED: 0,
            FAILED: 0
        };

        routes.forEach(route => {
            totalStops += route.stops.length;
            route.stops.forEach(stop => {
                if (stopStats[stop.status] !== undefined) {
                    stopStats[stop.status]++;
                }
            });
        });

        // 3. Active Drivers
        // Drivers with routes that are IN_PROGRESS
        const activeDriverIds = new Set(
            routes
                .filter(r => r.status === 'IN_PROGRESS' && r.driverId)
                .map(r => r.driverId)
        );

        console.log('\n--- DB STATS VERIFICATION ---');
        console.log('Routes Today:', routeStats);
        console.log('Stops Today:', { total: totalStops, ...stopStats });
        console.log('Active Drivers Count:', activeDriverIds.size);
        console.log('Ongoing Deliveries (Stops ON_THE_WAY + ARRIVED):', stopStats.ON_THE_WAY + stopStats.ARRIVED);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
