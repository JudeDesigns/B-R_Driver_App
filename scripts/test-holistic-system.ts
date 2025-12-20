
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting FINAL HOLISTIC SYSTEM TEST...\n');
    const timestamp = Date.now();

    // Keep track of created IDs for cleanup
    const createdIds: Record<string, string[]> = {
        users: [],
        customers: [],
        products: [],
        vehicles: [],
        routes: [],
        stops: [],
        files: [],
        categories: [],
        documents: []
    };

    try {
        // --- 1. User Management (Foundation) ---
        console.log('📦 1. Testing User Entities');
        const admin = await prisma.user.create({
            data: {
                username: `admin_${timestamp}`,
                password: 'password123',
                role: 'ADMIN',
                fullName: 'Holistic Admin'
            }
        });
        createdIds.users.push(admin.id);
        console.log('   ✅ Admin Created');

        const driver = await prisma.user.create({
            data: {
                username: `driver_${timestamp}`,
                password: 'password123',
                role: 'DRIVER',
                fullName: 'Holistic Driver'
            }
        });
        createdIds.users.push(driver.id);
        console.log('   ✅ Driver Created');

        // --- 2. Core Assets (Customer, Product, Vehicle) ---
        console.log('\n📦 2. Testing Core Assets');
        const customer = await prisma.customer.create({
            data: {
                name: 'Holistic Customer',
                email: `customer_${timestamp}@test.com`, // Unique constraint check
                address: '123 Holistic Way',
                paymentTerms: 'COD'
            }
        });
        createdIds.customers.push(customer.id);
        console.log('   ✅ Customer Created');

        const product = await prisma.product.create({
            data: {
                name: 'Holistic Widget',
                sku: `HW-${timestamp}`,
                unit: 'box'
            }
        });
        createdIds.products.push(product.id);
        console.log('   ✅ Product Created');

        const vehicle = await prisma.vehicle.create({
            data: {
                vehicleNumber: `V-${timestamp}`,
                make: 'Tesla',
                model: 'Semi',
                status: 'ACTIVE'
            }
        });
        createdIds.vehicles.push(vehicle.id);
        console.log('   ✅ Vehicle Created');

        // --- 3. Operations (Route, Stop, Assignment) ---
        console.log('\n📦 3. Testing Operations');

        // Vehicle Assignment
        const assignment = await prisma.vehicleAssignment.create({
            data: {
                vehicleId: vehicle.id,
                driverId: driver.id,
                assignedBy: admin.username
            }
        });
        console.log('   ✅ Vehicle Assigned to Driver');

        // Route
        const route = await prisma.route.create({
            data: {
                routeNumber: `R-${timestamp}`,
                date: new Date(),
                status: 'IN_PROGRESS',
                driverId: driver.id,
                uploadedBy: admin.id
            }
        });
        createdIds.routes.push(route.id);
        console.log('   ✅ Route Created');

        // Stop
        const stop = await prisma.stop.create({
            data: {
                routeId: route.id,
                customerId: customer.id,
                sequence: 1,
                address: customer.address,
                status: 'PENDING'
            }
        });
        createdIds.stops.push(stop.id);
        console.log('   ✅ Stop Created');

        // --- 4. Driver Workflow (Safety, Location, Returns) ---
        console.log('\n📦 4. Testing Driver Workflow');

        // Safety Declaration
        await prisma.safetyDeclaration.create({
            data: {
                driverId: driver.id,
                routeId: route.id,
                declarationType: 'DAILY',
                vehicleInspected: true,
                companyPolicies: true
            }
        });
        console.log('   ✅ Safety Declaration Signed');

        // Safety Check
        await prisma.safetyCheck.create({
            data: {
                routeId: route.id,
                driverId: driver.id,
                type: 'START_OF_DAY',
                responses: { lights: 'ok' }
            }
        });
        console.log('   ✅ Safety Check Submitted');

        // Driver Location
        await prisma.driverLocation.create({
            data: {
                driverId: driver.id,
                routeId: route.id,
                latitude: 34.0522,
                longitude: -118.2437
            }
        });
        console.log('   ✅ Driver Location Logged');

        // Return (requires Product)
        await prisma.return.create({
            data: {
                stopId: stop.id,
                productId: product.id,
                orderItemIdentifier: product.sku,
                quantity: 2,
                reasonCode: 'DAMAGED'
            }
        });
        console.log('   ✅ Return Processed');

        // Payment
        await prisma.payment.create({
            data: {
                stopId: stop.id,
                amount: 150.00,
                method: 'Check'
            }
        });
        console.log('   ✅ Payment Recorded');

        // --- 5. Admin Features (Notes, Uploads, Docs) ---
        console.log('\n📦 5. Testing Admin Features');

        // Admin Note
        await prisma.adminNote.create({
            data: {
                stopId: stop.id,
                adminId: admin.id,
                note: 'Urgent delivery'
            }
        });
        console.log('   ✅ Admin Note Added');

        // Route Upload Log
        await prisma.routeUpload.create({
            data: {
                fileName: 'routes.xlsx',
                originalFileName: 'routes.xlsx',
                uploadedBy: admin.id,
                status: 'COMPLETED'
            }
        });
        console.log('   ✅ Route Upload Logged');

        // System Document
        await prisma.systemDocument.create({
            data: {
                documentType: 'COMPANY_POLICY',
                fileName: 'policy.pdf',
                filePath: '/docs/policy.pdf'
            }
        });
        console.log('   ✅ System Document Created');

        // Customer Email Log
        await prisma.customerEmail.create({
            data: {
                stopId: stop.id,
                customerEmail: customer.email!,
                subject: 'Invoice',
                body: 'Here is your invoice',
                status: 'SENT'
            }
        });
        console.log('   ✅ Customer Email Logged');

        // --- 6. File Management (Categories, Files, Docs) ---
        console.log('\n📦 6. Testing File Management');

        const category = await prisma.fileCategory.create({
            data: {
                name: `Holistic Cat ${timestamp}`,
                pathPrefix: 'holistic'
            }
        });
        createdIds.categories.push(category.id);

        const file = await prisma.file.create({
            data: {
                originalName: 'image.png',
                storedName: `img_${timestamp}.png`,
                filePath: 'holistic/img.png',
                fileSize: 1024,
                mimeType: 'image/png',
                categoryId: category.id,
                uploadedBy: admin.id,
                checksum: `hash_${timestamp}`
            }
        });
        createdIds.files.push(file.id);
        console.log('   ✅ File System Verified');

        // Document (Admin Upload for Drivers)
        const doc = await prisma.document.create({
            data: {
                title: 'Driver Manual',
                type: 'OTHER',
                fileName: 'manual.pdf',
                filePath: '/uploads/manual.pdf',
                fileSize: 2048,
                mimeType: 'application/pdf',
                uploadedBy: admin.id
            }
        });
        createdIds.documents.push(doc.id);

        // Stop Document (Assignment)
        await prisma.stopDocument.create({
            data: {
                stopId: stop.id,
                documentId: doc.id
            }
        });
        console.log('   ✅ Document Assigned to Stop');

        console.log('\n✨ ALL 18 ENTITIES VERIFIED SUCCESSFULLY ✨');

        // --- Cleanup ---
        console.log('\n🧹 Cleaning up...');
        // Delete in reverse order of dependencies
        // (Simplified cleanup - in a real CI env we might truncate tables)
        // We will rely on the fact that this is a dev DB and we tracked IDs.
        // Note: Deleting User/Route will cascade to many relations or fail if no cascade.
        // For this test, we accept we might leave some traces or use cascade delete if configured.
        // Given the schema, manual cleanup is tedious. We'll try top-level deletions.

        // Delete child records of Stop first
        await prisma.return.deleteMany({ where: { stopId: stop.id } });
        await prisma.payment.deleteMany({ where: { stopId: stop.id } });
        await prisma.adminNote.deleteMany({ where: { stopId: stop.id } });
        await prisma.stopDocument.deleteMany({ where: { stopId: stop.id } });
        await prisma.customerEmail.deleteMany({ where: { stopId: stop.id } });
        await prisma.driverLocation.deleteMany({ where: { driverId: driver.id } }); // Also linked to Route/Stop
        await prisma.safetyCheck.deleteMany({ where: { routeId: route.id } });
        await prisma.safetyDeclaration.deleteMany({ where: { driverId: driver.id } });
        await prisma.vehicleAssignment.deleteMany({ where: { driverId: driver.id } });
        await prisma.routeUpload.deleteMany({ where: { uploadedBy: admin.id } });
        await prisma.systemDocument.deleteMany({ where: { fileName: 'policy.pdf' } });
        await prisma.file.deleteMany({ where: { categoryId: category.id } });
        await prisma.fileCategory.deleteMany({ where: { id: category.id } });
        await prisma.document.deleteMany({ where: { uploadedBy: admin.id } });

        await prisma.stop.deleteMany({ where: { routeId: route.id } }); // Cascades to Returns, Payments, Notes
        await prisma.route.delete({ where: { id: route.id } }); // Cascades to SafetyChecks
        await prisma.vehicle.delete({ where: { id: vehicle.id } });
        await prisma.product.delete({ where: { id: product.id } });
        await prisma.customer.delete({ where: { id: customer.id } });
        await prisma.user.deleteMany({ where: { id: { in: [admin.id, driver.id] } } });

        console.log('   ✅ Cleanup Complete');

    } catch (error) {
        console.error('\n❌ HOLISTIC TEST FAILED:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
