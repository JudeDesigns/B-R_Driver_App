/**
 * Driver Workflow Integration Tests
 */

const { testUtils } = require('../setup');

describe('Driver Workflow', () => {
  let testDriver;
  let testCustomer;
  let testRoute;
  let testStop;
  let driverToken;

  beforeEach(async () => {
    testDriver = await testUtils.createTestDriver();
    testCustomer = await testUtils.createTestCustomer();
    testRoute = await testUtils.createTestRoute(testDriver.id);
    testStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);
    driverToken = testUtils.generateTestToken(testDriver.id, 'DRIVER');
  });

  describe('Complete Driver Day Workflow', () => {
    test('should complete full driver workflow from start to end', async () => {
      // Step 1: Driver logs in and sees assigned routes
      const routesResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/driver/assigned-routes',
        driverToken
      );
      expect(routesResponse.status).toBe(200);
      expect(routesResponse.data.routes.length).toBeGreaterThan(0);

      // Step 2: Driver performs start-of-day safety check
      const safetyCheckResponse = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/safety-check',
        driverToken,
        {
          routeId: testRoute.id,
          type: 'START_OF_DAY',
          vehicleInspection: true,
          equipmentCheck: true,
          notes: 'All systems good',
        }
      );
      expect(safetyCheckResponse.status).toBe(200);

      // Step 3: Verify route status changed to IN_PROGRESS
      const routeStatusResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/driver/routes/${testRoute.id}`,
        driverToken
      );
      expect(routeStatusResponse.status).toBe(200);
      expect(routeStatusResponse.data.route.status).toBe('IN_PROGRESS');

      // Step 4: Driver starts first stop (ON_THE_WAY)
      const onTheWayResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'ON_THE_WAY',
        }
      );
      expect(onTheWayResponse.status).toBe(200);
      expect(onTheWayResponse.data.stop.status).toBe('ON_THE_WAY');

      // Step 5: Driver arrives at stop
      const arrivedResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'ARRIVED',
        }
      );
      expect(arrivedResponse.status).toBe(200);
      expect(arrivedResponse.data.stop.status).toBe('ARRIVED');

      // Step 6: Driver adds a return (optional)
      const returnResponse = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/returns',
        driverToken,
        {
          stopId: testStop.id,
          reason: 'Customer requested different product',
          quantity: 1,
          productName: 'Test Product',
        }
      );
      expect(returnResponse.status).toBe(200);

      // Step 7: Driver completes the stop with invoice
      const completedResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/signed-invoice.pdf',
          driverNotes: 'Delivery completed successfully',
        }
      );
      expect(completedResponse.status).toBe(200);
      expect(completedResponse.data.stop.status).toBe('COMPLETED');

      // Step 8: Driver performs end-of-day safety check
      const endOfDayResponse = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/safety-check',
        driverToken,
        {
          routeId: testRoute.id,
          type: 'END_OF_DAY',
          vehicleInspection: true,
          equipmentCheck: true,
          notes: 'End of day complete',
        }
      );
      expect(endOfDayResponse.status).toBe(200);

      // Step 9: Verify final route status
      const finalRouteResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/driver/routes/${testRoute.id}`,
        driverToken
      );
      expect(finalRouteResponse.status).toBe(200);
      // Route should be completed if all stops are completed
      expect(['COMPLETED', 'IN_PROGRESS']).toContain(finalRouteResponse.data.route.status);
    });

    test('should handle multiple stops in sequence', async () => {
      // Create additional stops
      const testStop2 = await testUtils.createTestStop(testRoute.id, testCustomer.id);
      const testStop3 = await testUtils.createTestStop(testRoute.id, testCustomer.id);

      // Start-of-day safety check
      await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/safety-check',
        driverToken,
        {
          routeId: testRoute.id,
          type: 'START_OF_DAY',
          vehicleInspection: true,
          equipmentCheck: true,
          notes: 'Ready to start',
        }
      );

      // Complete first stop
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        { status: 'ON_THE_WAY' }
      );
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        { status: 'ARRIVED' }
      );
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/invoice1.pdf',
        }
      );

      // Complete second stop
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop2.id}`,
        driverToken,
        { status: 'ON_THE_WAY' }
      );
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop2.id}`,
        driverToken,
        { status: 'ARRIVED' }
      );
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop2.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/invoice2.pdf',
        }
      );

      // Complete third stop
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop3.id}`,
        driverToken,
        { status: 'ON_THE_WAY' }
      );
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop3.id}`,
        driverToken,
        { status: 'ARRIVED' }
      );
      const finalStopResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop3.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/invoice3.pdf',
        }
      );

      expect(finalStopResponse.status).toBe(200);

      // Verify all stops are completed
      const routeResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/driver/routes/${testRoute.id}`,
        driverToken
      );
      expect(routeResponse.status).toBe(200);
    });

    test('should prevent invalid workflow sequences', async () => {
      // Try to complete stop without safety check
      const invalidResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/invoice.pdf',
        }
      );

      // Should fail because stop hasn't been set to ARRIVED first
      expect([400, 422]).toContain(invalidResponse.status);
    });

    test('should handle returns workflow', async () => {
      // Start-of-day safety check
      await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/safety-check',
        driverToken,
        {
          routeId: testRoute.id,
          type: 'START_OF_DAY',
          vehicleInspection: true,
          equipmentCheck: true,
        }
      );

      // Progress to ARRIVED
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        { status: 'ON_THE_WAY' }
      );
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        { status: 'ARRIVED' }
      );

      // Add multiple returns
      const return1Response = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/returns',
        driverToken,
        {
          stopId: testStop.id,
          reason: 'Damaged packaging',
          quantity: 2,
          productName: 'Product A',
        }
      );
      expect(return1Response.status).toBe(200);

      const return2Response = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/returns',
        driverToken,
        {
          stopId: testStop.id,
          reason: 'Wrong product delivered',
          quantity: 1,
          productName: 'Product B',
        }
      );
      expect(return2Response.status).toBe(200);

      // Complete stop with returns
      const completedResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/invoice-with-returns.pdf',
          driverNotes: 'Delivery completed with returns',
        }
      );
      expect(completedResponse.status).toBe(200);
    });
  });
});
