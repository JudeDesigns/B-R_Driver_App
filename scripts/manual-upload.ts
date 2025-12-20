
import * as fs from 'fs';
import * as path from 'path';
import { parseRouteExcel, saveRouteToDatabase } from '../src/lib/routeParser';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const filePath = path.join(process.cwd(), 'sample_route.xlsx');
        console.log(`Reading file from ${filePath}...`);

        const buffer = fs.readFileSync(filePath);

        console.log('Parsing Excel file...');
        const result = await parseRouteExcel(buffer);

        if (!result.success) {
            console.error('Parsing failed:', result.errors);
            process.exit(1);
        }

        console.log('Parsing successful!');
        console.log(`Found ${result.route?.stops.length} stops.`);

        if (result.warnings.length > 0) {
            console.warn('Warnings:', result.warnings);
        }

        // Find admin user to attribute upload to
        const admin = await prisma.user.findFirst({
            where: { role: 'ADMIN' }
        });

        if (!admin) {
            console.error('No admin user found to attribute upload to.');
            process.exit(1);
        }

        console.log(`Saving to database (uploaded by ${admin.username})...`);
        if (result.route) {
            const savedRoute = await saveRouteToDatabase(
                result.route,
                admin.id,
                'sample_route.xlsx',
                'create' // Force create/overwrite
            );
            console.log('Route saved successfully:', savedRoute);
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
