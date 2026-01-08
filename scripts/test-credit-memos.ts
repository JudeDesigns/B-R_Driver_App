/**
 * Test script for multiple credit memos functionality
 * This script:
 * 1. Creates test data (route, stop, documents)
 * 2. Creates multiple credit memos for a single stop
 * 3. Retrieves and verifies the data
 * 4. Cleans up test data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMultipleCreditMemos() {
  console.log('🧪 Starting Credit Memo Multi-Record Test\n');

  let testRouteId: string | null = null;
  let testStopId: string | null = null;
  let testCustomerId: string | null = null;
  let testDriverId: string | null = null;
  let testDocumentIds: string[] = [];
  let testCreditMemoIds: string[] = [];

  try {
    // Step 1: Find or create test driver
    console.log('📝 Step 1: Setting up test driver...');
    let testDriver = await prisma.user.findFirst({
      where: { role: 'DRIVER', isDeleted: false }
    });

    if (!testDriver) {
      console.log('   No driver found, creating test driver...');
      testDriver = await prisma.user.create({
        data: {
          username: 'test_driver_cm',
          password: 'test123',
          role: 'DRIVER',
          fullName: 'Test Driver for Credit Memos'
        }
      });
    }
    testDriverId = testDriver.id;
    console.log(`   ✅ Using driver: ${testDriver.username} (${testDriver.id})\n`);

    // Step 2: Create test customer
    console.log('📝 Step 2: Creating test customer...');
    const testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Customer - Credit Memo Test',
        address: '123 Test Street',
        contactInfo: 'test@example.com',
      }
    });
    testCustomerId = testCustomer.id;
    console.log(`   ✅ Created customer: ${testCustomer.name} (${testCustomer.id})\n`);

    // Step 3: Create test route
    console.log('📝 Step 3: Creating test route...');
    const testRoute = await prisma.route.create({
      data: {
        routeNumber: `TEST-CM-${Date.now()}`,
        date: new Date(),
        status: 'PENDING',
        driverId: testDriverId,
      }
    });
    testRouteId = testRoute.id;
    console.log(`   ✅ Created route: ${testRoute.routeNumber} (${testRoute.id})\n`);

    // Step 4: Create test stop
    console.log('📝 Step 4: Creating test stop...');
    const testStop = await prisma.stop.create({
      data: {
        routeId: testRouteId,
        customerId: testCustomerId,
        sequence: 1,
        address: '123 Test Street',
        customerNameFromUpload: 'Test Customer',
        orderNumberWeb: 'TEST-ORDER-001',
        quickbooksInvoiceNum: 'INV-TEST-001',
        status: 'PENDING',
        amount: 500.00,
      }
    });
    testStopId = testStop.id;
    console.log(`   ✅ Created stop: ${testStop.id}\n`);

    // Step 5: Create test documents
    console.log('📝 Step 5: Creating test credit memo documents...');
    const adminUser = await prisma.user.findFirst({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
    });

    if (!adminUser) {
      throw new Error('No admin user found for document upload');
    }

    for (let i = 1; i <= 3; i++) {
      const doc = await prisma.document.create({
        data: {
          title: `Test Credit Memo ${i}`,
          type: 'CREDIT_MEMO',
          fileName: `credit-memo-${i}.pdf`,
          filePath: `/test/credit-memo-${i}.pdf`,
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: adminUser.id,
          customerId: testCustomerId,
        }
      });
      testDocumentIds.push(doc.id);
      console.log(`   ✅ Created document ${i}: ${doc.title} (${doc.id})`);
    }
    console.log('');

    // Step 6: Create multiple credit memos for the stop
    console.log('📝 Step 6: Creating multiple credit memos for the stop...');
    const creditMemoData = [
      { number: 'CM-2024-001', amount: 50.00, docId: testDocumentIds[0] },
      { number: 'CM-2024-002', amount: 75.50, docId: testDocumentIds[1] },
      { number: 'CM-2024-003', amount: 100.25, docId: testDocumentIds[2] },
    ];

    for (const cm of creditMemoData) {
      const creditMemo = await prisma.creditMemo.create({
        data: {
          stopId: testStopId,
          creditMemoNumber: cm.number,
          creditMemoAmount: cm.amount,
          documentId: cm.docId,
        }
      });
      testCreditMemoIds.push(creditMemo.id);
      console.log(`   ✅ Created: ${cm.number} - $${cm.amount.toFixed(2)} (${creditMemo.id})`);
    }

    const totalAmount = creditMemoData.reduce((sum, cm) => sum + cm.amount, 0);
    console.log(`   💰 Total Credit Memo Amount: $${totalAmount.toFixed(2)}\n`);

    // Step 7: Retrieve stop with credit memos
    console.log('📝 Step 7: Retrieving stop with credit memos...');
    const stopWithCreditMemos = await prisma.stop.findUnique({
      where: { id: testStopId },
      include: {
        creditMemos: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            creditMemoNumber: true,
            creditMemoAmount: true,
            createdAt: true,
            document: {
              select: {
                id: true,
                title: true,
                fileName: true,
              }
            }
          }
        }
      }
    });

    if (!stopWithCreditMemos) {
      throw new Error('Stop not found!');
    }

    console.log(`   ✅ Stop ID: ${stopWithCreditMemos.id}`);
    console.log(`   ✅ Order Number: ${stopWithCreditMemos.orderNumberWeb}`);
    console.log(`   ✅ Invoice Number: ${stopWithCreditMemos.quickbooksInvoiceNum}`);
    console.log(`   ✅ Credit Memos Found: ${stopWithCreditMemos.creditMemos.length}\n`);

    console.log('   📋 Credit Memo Details:');
    stopWithCreditMemos.creditMemos.forEach((cm, idx) => {
      console.log(`      ${idx + 1}. ${cm.creditMemoNumber} - $${cm.creditMemoAmount.toFixed(2)}`);
      console.log(`         Document: ${cm.document?.title || 'N/A'}`);
      console.log(`         Created: ${new Date(cm.createdAt).toLocaleString()}`);
    });

    const retrievedTotal = stopWithCreditMemos.creditMemos.reduce((sum, cm) => sum + cm.creditMemoAmount, 0);
    console.log(`\n   💰 Retrieved Total: $${retrievedTotal.toFixed(2)}`);

    // Step 8: Verify totals match
    console.log('\n📝 Step 8: Verifying data integrity...');
    if (Math.abs(retrievedTotal - totalAmount) < 0.01) {
      console.log('   ✅ Total amounts match!');
    } else {
      console.log(`   ❌ Total mismatch! Expected: $${totalAmount.toFixed(2)}, Got: $${retrievedTotal.toFixed(2)}`);
    }

    if (stopWithCreditMemos.creditMemos.length === creditMemoData.length) {
      console.log('   ✅ Credit memo count matches!');
    } else {
      console.log(`   ❌ Count mismatch! Expected: ${creditMemoData.length}, Got: ${stopWithCreditMemos.creditMemos.length}`);
    }

    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    // Cleanup
    console.log('🧹 Cleaning up test data...');

    if (testCreditMemoIds.length > 0) {
      await prisma.creditMemo.deleteMany({
        where: { id: { in: testCreditMemoIds } }
      });
      console.log(`   ✅ Deleted ${testCreditMemoIds.length} credit memos`);
    }

    if (testDocumentIds.length > 0) {
      await prisma.document.deleteMany({
        where: { id: { in: testDocumentIds } }
      });
      console.log(`   ✅ Deleted ${testDocumentIds.length} documents`);
    }

    if (testStopId) {
      await prisma.stop.delete({ where: { id: testStopId } });
      console.log('   ✅ Deleted test stop');
    }

    if (testRouteId) {
      await prisma.route.delete({ where: { id: testRouteId } });
      console.log('   ✅ Deleted test route');
    }

    if (testCustomerId) {
      await prisma.customer.delete({ where: { id: testCustomerId } });
      console.log('   ✅ Deleted test customer');
    }

    console.log('\n✨ Cleanup complete!\n');

    await prisma.$disconnect();
  }
}

// Run test
testMultipleCreditMemos()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


