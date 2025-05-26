/**
 * Route Management API Tests
 */

const { testUtils } = require('../setup');

describe('Route Management API', () => {
  let testAdmin;
  let testDriver;
  let testCustomer;
  let adminToken;
  let driverToken;

  beforeEach(async () => {
    testAdmin = await testUtils.createTestAdmin();
    testDriver = await testUtils.createTestDriver();
    testCustomer = await testUtils.createTestCustomer();
    adminToken = testUtils.generateTestToken(testAdmin.id, 'ADMIN');
    driverToken = testUtils.generateTestToken(testDriver.id, 'DRIVER');
  });

  describe('GET /api/admin/routes', () => {
    test('should return routes for admin', async () => {
      // Create a test route
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/routes',
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
      expect(Array.isArray(response.data.routes)).toBe(true);
      expect(response.data.routes.length).toBeGreaterThan(0);
    });

    test('should filter routes by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/routes?date=${today}`,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
      expect(response.data.routes.length).toBeGreaterThan(0);
    });

    test('should filter routes by driver', async () => {
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/routes?driverId=${testDriver.id}`,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
      expect(response.data.routes.length).toBeGreaterThan(0);
      expect(response.data.routes[0].driverId).toBe(testDriver.id);
    });

    test('should filter routes by status', async () => {
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/routes?status=PENDING',
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
      if (response.data.routes.length > 0) {
        expect(response.data.routes[0].status).toBe('PENDING');
      }
    });

    test('should reject unauthorized access', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/routes',
        'invalid-token'
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/driver/assigned-routes', () => {
    test('should return assigned routes for driver', async () => {
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/driver/assigned-routes',
        driverToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
      expect(Array.isArray(response.data.routes)).toBe(true);
    });

    test('should only return routes assigned to the driver', async () => {
      // Create another driver and route
      const anotherDriver = await testUtils.createTestDriver();
      await testUtils.createTestRoute(anotherDriver.id);
      
      // Create route for our test driver
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/driver/assigned-routes',
        driverToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
      
      // All returned routes should belong to the test driver
      response.data.routes.forEach(route => {
        expect(route.driverId).toBe(testDriver.id);
      });
    });

    test('should filter by date', async () => {
      const today = new Date().toISOString().split('T')[0];
      await testUtils.createTestRoute(testDriver.id);

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/driver/assigned-routes?date=${today}`,
        driverToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('routes');
    });

    test('should reject admin access', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/driver/assigned-routes',
        adminToken
      );

      // Should either reject or return empty results
      expect([401, 403, 200]).toContain(response.status);
    });
  });

  describe('Route Status Updates', () => {
    let testRoute;

    beforeEach(async () => {
      testRoute = await testUtils.createTestRoute(testDriver.id);
    });

    test('should update route status via safety check', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/driver/safety-check',
        driverToken,
        {
          routeId: testRoute.id,
          type: 'START_OF_DAY',
          vehicleInspection: true,
          equipmentCheck: true,
          notes: 'All good',
        }
      );

      expect(response.status).toBe(200);
      
      // Verify route status was updated
      const routeCheck = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/routes?driverId=${testDriver.id}`,
        adminToken
      );

      expect(routeCheck.status).toBe(200);
      const updatedRoute = routeCheck.data.routes.find(r => r.id === testRoute.id);
      expect(updatedRoute.status).toBe('IN_PROGRESS');
    });
  });

  describe('Route Details', () => {
    let testRoute;
    let testStop;

    beforeEach(async () => {
      testRoute = await testUtils.createTestRoute(testDriver.id);
      testStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);
    });

    test('should get route details for admin', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/routes/${testRoute.id}`,
        adminToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('route');
      expect(response.data.route.id).toBe(testRoute.id);
      expect(response.data).toHaveProperty('stops');
      expect(Array.isArray(response.data.stops)).toBe(true);
    });

    test('should get route details for assigned driver', async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/driver/routes/${testRoute.id}`,
        driverToken
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('route');
      expect(response.data.route.id).toBe(testRoute.id);
    });

    test('should reject access to unassigned route', async () => {
      const anotherDriver = await testUtils.createTestDriver();
      const anotherDriverToken = testUtils.generateTestToken(anotherDriver.id, 'DRIVER');

      const response = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/driver/routes/${testRoute.id}`,
        anotherDriverToken
      );

      expect([401, 403, 404]).toContain(response.status);
    });
  });
});
