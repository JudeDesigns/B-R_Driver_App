
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '1d',
        issuer: "br-food-services",
        audience: "br-food-services-users"
    });
}

async function main() {
    console.log('🚀 Starting Driver Location Verification...');

    // 1. Setup Test Data
    const timestamp = Date.now();
    const driverUsername = `loc_test_driver_${timestamp}`;
    const driverPassword = 'password123';

    console.log('1️⃣ Creating Test Driver...');
    const driver = await prisma.user.create({
        data: {
            username: driverUsername,
            password: driverPassword,
            role: 'DRIVER',
            fullName: 'Location Test Driver',
        }
    });

    const token = generateToken({ id: driver.id, username: driver.username, role: 'DRIVER' });
    console.log('✅ Driver Created & Token Generated');

    console.log('2️⃣ Creating Test Customer...');
    const customer = await prisma.customer.create({
        data: {
            name: `Loc Test Customer ${timestamp}`,
            address: '123 Test St, San Francisco, CA',
            email: `loc_cust_${timestamp}@example.com`
        }
    });
    console.log('✅ Customer Created');

    console.log('3️⃣ Creating Test Route & Stop...');
    const route = await prisma.route.create({
        data: {
            routeNumber: `LOC-${timestamp}`,
            date: new Date(),
            driverId: driver.id,
            status: 'IN_PROGRESS'
        }
    });

    const stop = await prisma.stop.create({
        data: {
            routeId: route.id,
            customerId: customer.id,
            sequence: 1,
            customerNameFromUpload: 'Location Test Customer',
            address: '123 Test St, San Francisco, CA',
            status: 'ON_THE_WAY'
        }
    });
    console.log('✅ Route & Stop Created');

    // 2. Test Location Update
    console.log('4️⃣ Sending Location Update...');
    const locationPayload = {
        latitude: 37.7749,
        longitude: -122.4194,
        stopId: stop.id,
        routeId: route.id,
        accuracy: 10
    };

    try {
        const response = await fetch(`${BASE_URL}/api/driver/location`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(locationPayload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error: ${response.status} - ${text}`);
        }

        const data = await response.json();
        console.log('✅ API Response:', data);

        // 3. Verify Database Updates
        console.log('5️⃣ Verifying Database Updates...');

        // Check DriverLocation history
        const locationRecord = await prisma.driverLocation.findFirst({
            where: {
                driverId: driver.id,
                stopId: stop.id
            }
        });

        if (!locationRecord) throw new Error('DriverLocation record not found!');
        if (Math.abs(locationRecord.latitude - locationPayload.latitude) > 0.0001) throw new Error('Latitude mismatch in history');
        console.log('✅ DriverLocation History Verified');

        // Check User last location
        const updatedDriver = await prisma.user.findUnique({
            where: { id: driver.id }
        });

        if (!updatedDriver) throw new Error('Driver not found');
        if (Math.abs(updatedDriver.lastKnownLatitude - locationPayload.latitude) > 0.0001) throw new Error('Latitude mismatch in User record');
        console.log('✅ User Last Location Verified');

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        // 4. Cleanup
        console.log('6️⃣ Cleaning up...');
        try {
            await prisma.driverLocation.deleteMany({ where: { driverId: driver.id } });
            await prisma.stop.delete({ where: { id: stop.id } });
            await prisma.route.delete({ where: { id: route.id } });
            await prisma.customer.delete({ where: { id: customer.id } });
            await prisma.user.delete({ where: { id: driver.id } });
            console.log('✅ Cleanup Complete');
        } catch (cleanupError) {
            console.error('⚠️ Cleanup Warning:', cleanupError);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
