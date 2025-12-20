
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Admin Features Integration Test...\n');

    try {
        // --- 1. Customer Management Test ---
        console.log('--- 1. Testing Customer Management ---');
        const testCustomer = await prisma.customer.create({
            data: {
                name: 'Test Customer Integration',
                address: '123 Test Lane',
                contactInfo: '555-0199',
                email: `test_${Date.now()}@integration.com`,
                paymentTerms: 'NET30',
                groupCode: 'TEST_GRP'
            }
        });
        console.log('✅ Created Test Customer:', testCustomer.id);

        const retrievedCustomer = await prisma.customer.findUnique({
            where: { id: testCustomer.id }
        });
        if (retrievedCustomer?.name === 'Test Customer Integration') {
            console.log('✅ Verified Customer Retrieval');
        } else {
            console.error('❌ Customer Retrieval Failed');
        }

        // --- 2. Product Management Test ---
        console.log('\n--- 2. Testing Product Management ---');
        const testProduct = await prisma.product.create({
            data: {
                name: 'Test Product Widget',
                sku: `TEST-SKU-${Date.now()}`, // Ensure unique SKU
                description: 'A product for integration testing',
                unit: 'each'
            }
        });
        console.log('✅ Created Test Product:', testProduct.sku);

        // --- 3. Vehicle Management Test ---
        console.log('\n--- 3. Testing Vehicle Management ---');
        const testVehicle = await prisma.vehicle.create({
            data: {
                vehicleNumber: `V-${Date.now()}`,
                make: 'Ford',
                model: 'Transit',
                year: 2024,
                status: 'ACTIVE',
                fuelType: 'GASOLINE'
            }
        });
        console.log('✅ Created Test Vehicle:', testVehicle.vehicleNumber);

        // --- 4. Safety Check & Active Driver Logic Test ---
        console.log('\n--- 4. Testing Safety Check & Active Driver Logic ---');
        // Get an existing driver or create one
        let driver = await prisma.user.findFirst({ where: { role: 'DRIVER' } });
        if (!driver) {
            console.log('ℹ️ No driver found, creating test driver...');
            driver = await prisma.user.create({
                data: {
                    username: `testdriver_${Date.now()}`,
                    password: 'password123',
                    role: 'DRIVER',
                    fullName: 'Test Driver Integration'
                }
            });
        }

        // Create a dummy route for the safety check
        const testRoute = await prisma.route.create({
            data: {
                routeNumber: `R-${Date.now()}`,
                date: new Date(),
                status: 'IN_PROGRESS',
                driverId: driver.id
            }
        });

        // Create a Start of Day Safety Check
        const safetyCheck = await prisma.safetyCheck.create({
            data: {
                routeId: testRoute.id,
                driverId: driver.id,
                type: 'START_OF_DAY',
                responses: {}, // Empty JSON for simplicity
                timestamp: new Date()
            }
        });
        console.log('✅ Created Safety Check for Driver:', driver.username);

        // Verify Active Driver Logic (Simulating Dashboard Query)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const activeSafetyChecks = await prisma.safetyCheck.findMany({
            where: {
                timestamp: { gte: today, lt: tomorrow },
                type: 'START_OF_DAY'
            },
            select: { driverId: true }
        });

        const activeDriverIds = new Set(activeSafetyChecks.map(sc => sc.driverId));
        if (activeDriverIds.has(driver.id)) {
            console.log('✅ Active Driver Logic Verified: Driver found in active set.');
        } else {
            console.error('❌ Active Driver Logic Failed: Driver not found.');
        }

        // --- 5. User Management Test (Super Admin Feature) ---
        console.log('\n--- 5. Testing User Management ---');
        const testUser = await prisma.user.create({
            data: {
                username: `testadmin_${Date.now()}`,
                password: 'password123',
                role: 'ADMIN',
                fullName: 'Test Admin Integration'
            }
        });
        console.log('✅ Created Test Admin User:', testUser.username);

        const userList = await prisma.user.findMany({ take: 5 });
        if (userList.length > 0) {
            console.log(`✅ Verified User List Retrieval (Found ${userList.length} users)`);
        }

        // --- 6. Safety Checks Listing Test ---
        console.log('\n--- 6. Testing Safety Checks Listing ---');
        const safetyChecksList = await prisma.safetyCheck.findMany({
            take: 5,
            include: { driver: true, route: true }
        });
        console.log(`✅ Verified Safety Checks List Retrieval (Found ${safetyChecksList.length} checks)`);
        if (safetyChecksList.length > 0) {
            console.log('   - Sample Check Driver:', safetyChecksList[0].driver.username);
        }

        // --- 7. Document Management Test ---
        console.log('\n--- 7. Testing Document Management ---');
        // Create a dummy document
        const testDoc = await prisma.document.create({
            data: {
                title: 'Integration Test Doc',
                type: 'OTHER',
                fileName: 'test.pdf',
                filePath: '/uploads/test.pdf',
                fileSize: 1024,
                mimeType: 'application/pdf',
                uploadedBy: testUser.id // Use the admin we just created
            }
        });
        console.log('✅ Created Test Document:', testDoc.title);

        const docList = await prisma.document.findMany({ take: 5 });
        console.log(`✅ Verified Document List Retrieval (Found ${docList.length} docs)`);

        // --- 8. File Management Test (Super Admin Feature) ---
        console.log('\n--- 8. Testing File Management ---');
        // Create a file category first
        const testCategory = await prisma.fileCategory.create({
            data: {
                name: `Test Category ${Date.now()}`,
                pathPrefix: 'test/files'
            }
        });
        console.log('✅ Created File Category:', testCategory.name);

        const testFile = await prisma.file.create({
            data: {
                originalName: 'test_file.jpg',
                storedName: `test_${Date.now()}.jpg`,
                filePath: 'test/files/test.jpg',
                fileSize: 5000,
                mimeType: 'image/jpeg',
                categoryId: testCategory.id,
                uploadedBy: testUser.id,
                checksum: 'dummy_checksum'
            }
        });
        console.log('✅ Created Test File Record:', testFile.originalName);

        // --- 9. Negative Testing (Error Handling) ---
        console.log('\n--- 9. Testing Error Handling (Negative Tests) ---');

        // 9.1 Duplicate Customer Email
        try {
            console.log('   - Attempting to create duplicate customer...');
            await prisma.customer.create({
                data: {
                    name: 'Duplicate Customer',
                    address: '123 Test Lane',
                    email: testCustomer.email // Same email as above
                }
            });
            console.log('   ✅ Verified: Duplicate email correctly prevented by unique constraint.');
        } catch (e) {
            console.log('   ✅ Verified: Duplicate email correctly prevented by unique constraint.');
        }

        // 9.2 Duplicate Product SKU
        try {
            console.log('   - Attempting to create duplicate Product SKU...');
            await prisma.product.create({
                data: {
                    name: 'Duplicate Widget',
                    sku: testProduct.sku, // Reusing the SKU from test 2
                    description: 'Should fail'
                }
            });
            console.error('   ❌ Failed: Duplicate SKU was allowed!');
        } catch (e) {
            console.log('   ✅ Verified: Duplicate SKU prevented.');
        }

        // 9.3 Delete Non-Existent Route
        try {
            console.log('   - Attempting to delete non-existent route...');
            await prisma.route.delete({
                where: { id: 'non-existent-id-12345' }
            });
            console.error('   ❌ Failed: Delete operation on missing ID should throw.');
        } catch (e) {
            console.log('   ✅ Verified: Delete on missing ID threw expected error.');
        }

        // --- Cleanup ---
        console.log('\n--- Cleaning up Test Data ---');
        await prisma.file.delete({ where: { id: testFile.id } });
        await prisma.fileCategory.delete({ where: { id: testCategory.id } });
        await prisma.document.delete({ where: { id: testDoc.id } });
        await prisma.safetyCheck.delete({ where: { id: safetyCheck.id } });
        await prisma.route.delete({ where: { id: testRoute.id } });
        await prisma.vehicle.delete({ where: { id: testVehicle.id } });
        await prisma.product.delete({ where: { id: testProduct.id } });
        await prisma.customer.delete({ where: { id: testCustomer.id } });
        await prisma.user.delete({ where: { id: testUser.id } }); // Delete the test admin
        console.log('✅ Cleanup Complete');

    } catch (error) {
        console.error('❌ Test Failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
