/**
 * Stop Management API Tests
 */

const { testUtils } = require('../setup');

describe('Stop Management API', () => {
  let testAdmin;
  let testDriver;
  let testCustomer;
  let testRoute;
  let testStop;
  let adminToken;
  let driverToken;

  beforeEach(async () => {
    testAdmin = await testUtils.createTestAdmin();
    testDriver = await testUtils.createTestDriver();
    testCustomer = await testUtils.createTestCustomer();
    testRoute = await testUtils.createTestRoute(testDriver.id);
    testStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);
    adminToken = testUtils.generateTestToken(testAdmin.id, 'ADMIN');
    driverToken = testUtils.generateTestToken(testDriver.id, 'DRIVER');
  });

  describe('GET /api/admin/stops', () => {
    test('should return stops for admin', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/stops',
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stops');
      expect(Array.isArray(response.data.stops)).toBe(true);
      expect(response.data.stops.length).toBeGreaterThan(0);
    });

    test('should filter stops by route', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/stops?routeId=${testRoute.id}`,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stops');
      response.data.stops.forEach(stop => {
        expect(stop.routeId).toBe(testRoute.id);
      });
    });

    test('should filter stops by status', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/stops?status=PENDING',
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stops');
      if (response.data.stops.length > 0) {
        response.data.stops.forEach(stop => {
          expect(stop.status).toBe('PENDING');
        });
      }
    });
  });

  describe('PUT /api/driver/stops/:id', () => {
    test('should update stop status to ON_THE_WAY', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'ON_THE_WAY',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stop');
      expect(response.data.stop.status).toBe('ON_THE_WAY');
    });

    test('should update stop status to ARRIVED', async () => {
      // First set to ON_THE_WAY
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        { status: 'ON_THE_WAY' }
      );

      const response = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'ARRIVED',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stop');
      expect(response.data.stop.status).toBe('ARRIVED');
    });

    test('should complete stop with invoice upload', async () => {
      // First set to ARRIVED
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

      const response = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'COMPLETED',
          signedInvoicePdfUrl: 'https://example.com/invoice.pdf',
          driverNotes: 'Delivery completed successfully',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stop');
      expect(response.data.stop.status).toBe('COMPLETED');
      expect(response.data.stop.signedInvoicePdfUrl).toBe('https://example.com/invoice.pdf');
    });

    test('should reject invalid status transitions', async () => {
      // Try to go directly from PENDING to COMPLETED
      const response = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        {
          status: 'COMPLETED',
        }
      );

      expect([400, 422]).toContain(response.status);
    });

    test('should reject unauthorized driver access', async () => {
      const anotherDriver = await testUtils.createTestDriver();
      const anotherDriverToken = testUtils.generateTestToken(anotherDriver.id, 'DRIVER');

      const response = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        anotherDriverToken,
        {
          status: 'ON_THE_WAY',
        }
      );

      expect([401, 403, 404]).toContain(response.status);
    });
  });

  describe('POST /api/driver/returns', () => {
    beforeEach(async () => {
      // Set stop to ARRIVED so returns can be added
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
    });

    test('should create a return for a stop', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/returns',
        driverToken,
        {
          stopId: testStop.id,
          reason: 'Damaged goods',
          quantity: 2,
          productName: 'Test Product',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('return');
      expect(response.data.return.reason).toBe('Damaged goods');
      expect(response.data.return.quantity).toBe(2);
    });

    test('should reject returns for non-arrived stops', async () => {
      // Create a new stop that's still pending
      const newStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/returns',
        driverToken,
        {
          stopId: newStop.id,
          reason: 'Damaged goods',
          quantity: 1,
          productName: 'Test Product',
        }
      );

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('GET /api/admin/stops/:id', () => {
    test('should get stop details for admin', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/stops/${testStop.id}`,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('stop');
      expect(response.data.stop.id).toBe(testStop.id);
      expect(response.data).toHaveProperty('customer');
      expect(response.data).toHaveProperty('route');
    });

    test('should include returns in stop details', async () => {
      // First add a return
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
        'POST',
        '/api/driver/returns',
        driverToken,
        {
          stopId: testStop.id,
          reason: 'Damaged goods',
          quantity: 1,
          productName: 'Test Product',
        }
      );

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/stops/${testStop.id}`,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('returns');
      expect(Array.isArray(response.data.returns)).toBe(true);
      expect(response.data.returns.length).toBeGreaterThan(0);
    });
  });
});
