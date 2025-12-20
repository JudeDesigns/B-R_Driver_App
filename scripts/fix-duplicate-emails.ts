
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking for duplicate customer emails...');

    const customers = await prisma.customer.groupBy({
        by: ['email'],
        _count: {
            email: true
        },
        having: {
            email: {
                _count: {
                    gt: 1
                }
            }
        }
    });

    if (customers.length > 0) {
        console.log('Found duplicate emails:', customers);
        console.log('Cleaning up duplicates...');

        for (const group of customers) {
            if (!group.email) continue;

            // Find all customers with this email
            const duplicates = await prisma.customer.findMany({
                where: { email: group.email },
                orderBy: { createdAt: 'desc' } // Keep the newest one
            });

            // Keep the first one (newest), delete the rest
            const [keep, ...remove] = duplicates;

            console.log(`Keeping ${keep.id} (${keep.email}), deleting ${remove.length} others.`);

            for (const dup of remove) {
                // Check if we can delete (might have relations)
                // For this dev env, we'll try to delete. If it fails due to FK, we might need to update relations or just warn.
                try {
                    // First delete related stops or other dependencies if strictly needed, 
                    // but usually cascade or just deleting the customer is enough if no strict constraints block it.
                    // In this schema, Customer has Stops. Stop has relations.
                    // We might just update the email of duplicates to be unique if deletion is too risky.
                    // Let's try appending a timestamp to the email to make it unique.

                    const newEmail = `duplicate_${Date.now()}_${dup.email}`;
                    await prisma.customer.update({
                        where: { id: dup.id },
                        data: { email: newEmail }
                    });
                    console.log(`Renamed duplicate ${dup.id} to ${newEmail}`);

                } catch (e) {
                    console.error(`Failed to handle duplicate ${dup.id}:`, e);
                }
            }
        }
    } else {
        console.log('No duplicate emails found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
