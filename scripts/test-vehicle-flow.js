const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const prisma = new PrismaClient();

// Helper to generate token
function generateToken(userId, role) {
    return jwt.sign(
        { id: userId, role: role },
        process.env.JWT_SECRET,
        {
            expiresIn: '1h',
            issuer: 'br-food-services',
            audience: 'br-food-services-users',
        }
    );
}

async function main() {
    console.log('🚀 Starting Vehicle Flow Verification...');

    let adminUser, driverUser, vehicle, systemDoc;

    try {
        // 1. Setup: Create Admin, Driver, Vehicle, and System Document
        console.log('\n1. Setting up test data...');

        // Create Admin
        adminUser = await prisma.user.create({
            data: {
                username: `admin_test_${Date.now()}`,
                password: 'password123',
                role: 'ADMIN',
                fullName: 'Test Admin',
            },
        });
        console.log(`✅ Created Admin: ${adminUser.username}`);

        // Create Driver
        driverUser = await prisma.user.create({
            data: {
                username: `driver_test_${Date.now()}`,
                password: 'password123',
                role: 'DRIVER',
                fullName: 'Test Driver',
            },
        });
        console.log(`✅ Created Driver: ${driverUser.username}`);

        // Create Vehicle
        vehicle = await prisma.vehicle.create({
            data: {
                vehicleNumber: `V-${Date.now()}`,
                status: 'ACTIVE',
                fuelType: 'DIESEL',
                fuelInstructions: 'Use only Pump #5. Enter code 1234.',
            },
        });
        console.log(`✅ Created Vehicle: ${vehicle.vehicleNumber}`);

        // Create System Document (Safety Instructions)
        systemDoc = await prisma.systemDocument.create({
            data: {
                documentType: 'SAFETY_INSTRUCTIONS',
                fileName: 'Safety_2025.pdf',
                filePath: '/docs/safety_2025.pdf',
                isActive: true,
            },
        });
        console.log(`✅ Created System Document: ${systemDoc.fileName}`);

        // 2. Test Vehicle Assignment API
        console.log('\n2. Testing Vehicle Assignment API...');
        const adminToken = generateToken(adminUser.id, 'ADMIN');

        // Simulate API call to assign driver
        // We'll use Prisma directly here to simulate the API logic, 
        // but in a real integration test we'd hit the endpoint.
        // For this script, we want to verify the logic works.

        // Deactivate existing
        await prisma.vehicleAssignment.updateMany({
            where: { vehicleId: vehicle.id, isActive: true },
            data: { isActive: false },
        });

        // Create new assignment
        const assignment = await prisma.vehicleAssignment.create({
            data: {
                vehicleId: vehicle.id,
                driverId: driverUser.id,
                assignedBy: adminUser.id,
                isActive: true,
                notes: 'Test assignment',
            },
        });
        console.log(`✅ Assigned Driver to Vehicle. Assignment ID: ${assignment.id}`);

        // 3. Verify Admin View (Vehicle Details)
        console.log('\n3. Verifying Admin View Data...');
        const vehicleWithAssignments = await prisma.vehicle.findUnique({
            where: { id: vehicle.id },
            include: {
                assignments: {
                    include: { driver: true },
                },
            },
        });

        const activeAssignment = vehicleWithAssignments.assignments.find(a => a.isActive);
        if (activeAssignment && activeAssignment.driverId === driverUser.id) {
            console.log('✅ Admin View: Active assignment correctly found.');
        } else {
            console.error('❌ Admin View: Active assignment NOT found or incorrect.');
        }

        // 4. Test Driver View (Assigned Routes & Vehicle Info)
        console.log('\n4. Verifying Driver View Data...');
        // Create a dummy route to link them (since the API logic often relies on routes)
        // But our new logic in assigned-routes API also looks for vehicle assignments directly?
        // Let's check the API logic we wrote:
        // "Get routes where the driver is assigned via vehicle assignment"
        // It finds vehicle assignments, gets routeIds, and fetches those routes.
        // So we need a route linked to this assignment for it to show up in "Assigned Routes".

        const route = await prisma.route.create({
            data: {
                routeNumber: `R-${Date.now()}`,
                date: new Date(),
                status: 'PENDING',
            },
        });

        // Link assignment to route
        await prisma.vehicleAssignment.update({
            where: { id: assignment.id },
            data: { routeId: route.id },
        });
        console.log(`✅ Created Route ${route.routeNumber} and linked to Assignment.`);

        // Now simulate the "Assigned Routes" query logic
        const driverRoutes = await prisma.route.findMany({
            where: {
                id: route.id,
            },
            include: {
                vehicleAssignments: {
                    where: {
                        driverId: driverUser.id,
                        isActive: true,
                    },
                    include: {
                        vehicle: true,
                    },
                },
            },
        });

        if (driverRoutes.length > 0 && driverRoutes[0].vehicleAssignments.length > 0) {
            const fetchedVehicle = driverRoutes[0].vehicleAssignments[0].vehicle;
            console.log(`✅ Driver View: Found route with vehicle: ${fetchedVehicle.vehicleNumber}`);
            console.log(`   Fuel Instructions: "${fetchedVehicle.fuelInstructions}"`);

            if (fetchedVehicle.fuelInstructions === 'Use only Pump #5. Enter code 1234.') {
                console.log('✅ Fuel Instructions match!');
            } else {
                console.error('❌ Fuel Instructions do not match.');
            }
        } else {
            console.error('❌ Driver View: Route or Vehicle Assignment not found.');
        }

        // 5. Test System Documents Fetch
        console.log('\n5. Verifying System Documents Fetch...');
        const fetchedDocs = await prisma.systemDocument.findMany({
            where: {
                isActive: true,
                isDeleted: false,
                documentType: 'SAFETY_INSTRUCTIONS',
            },
        });

        if (fetchedDocs.length > 0 && fetchedDocs[0].fileName === 'Safety_2025.pdf') {
            console.log('✅ System Documents: Safety Instructions found.');
        } else {
            console.error('❌ System Documents: Safety Instructions NOT found.');
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        if (adminUser) await prisma.user.delete({ where: { id: adminUser.id } });
        if (driverUser) {
            // Delete related records first
            await prisma.vehicleAssignment.deleteMany({ where: { driverId: driverUser.id } });
            await prisma.user.delete({ where: { id: driverUser.id } });
        }
        if (vehicle) await prisma.vehicle.delete({ where: { id: vehicle.id } });
        if (systemDoc) await prisma.systemDocument.delete({ where: { id: systemDoc.id } });

        await prisma.$disconnect();
    }
}

main();
