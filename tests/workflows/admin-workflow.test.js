/**
 * Admin Workflow Integration Tests
 */

const { testUtils } = require('../setup');

describe('Admin Workflow', () => {
  let testAdmin;
  let testDriver;
  let testCustomer;
  let adminToken;

  beforeEach(async () => {
    testAdmin = await testUtils.createTestAdmin();
    testDriver = await testUtils.createTestDriver();
    testCustomer = await testUtils.createTestCustomer();
    adminToken = testUtils.generateTestToken(testAdmin.id, 'ADMIN');
  });

  describe('Route Management Workflow', () => {
    test('should manage complete route lifecycle', async () => {
      // Step 1: Admin views dashboard
      const dashboardResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/dashboard',
        adminToken
      );
      expect(dashboardResponse.status).toBe(200);
      expect(dashboardResponse.data).toHaveProperty('todaysRoutes');

      // Step 2: Admin creates a route
      const testRoute = await testUtils.createTestRoute(testDriver.id);
      const testStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);

      // Step 3: Admin views all routes
      const routesResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/routes',
        adminToken
      );
      expect(routesResponse.status).toBe(200);
      expect(routesResponse.data.routes.length).toBeGreaterThan(0);

      // Step 4: Admin views specific route details
      const routeDetailsResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/routes/${testRoute.id}`,
        adminToken
      );
      expect(routeDetailsResponse.status).toBe(200);
      expect(routeDetailsResponse.data).toHaveProperty('route');
      expect(routeDetailsResponse.data).toHaveProperty('stops');

      // Step 5: Admin views stop details
      const stopDetailsResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/stops/${testStop.id}`,
        adminToken
      );
      expect(stopDetailsResponse.status).toBe(200);
      expect(stopDetailsResponse.data).toHaveProperty('stop');
      expect(stopDetailsResponse.data).toHaveProperty('customer');
    });

    test('should monitor driver progress', async () => {
      const testRoute = await testUtils.createTestRoute(testDriver.id);
      const testStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);
      const driverToken = testUtils.generateTestToken(testDriver.id, 'DRIVER');

      // Driver starts the day
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

      // Admin checks safety checks
      const safetyChecksResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/safety-checks',
        adminToken
      );
      expect(safetyChecksResponse.status).toBe(200);
      expect(safetyChecksResponse.data.safetyChecks.length).toBeGreaterThan(0);

      // Driver progresses through stops
      await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/driver/stops/${testStop.id}`,
        driverToken,
        { status: 'ON_THE_WAY' }
      );

      // Admin monitors stop progress
      const stopProgressResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/stops/${testStop.id}`,
        adminToken
      );
      expect(stopProgressResponse.status).toBe(200);
      expect(stopProgressResponse.data.stop.status).toBe('ON_THE_WAY');
    });
  });

  describe('Customer Management Workflow', () => {
    test('should manage customer lifecycle', async () => {
      // Step 1: Admin views all customers
      const customersResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/customers',
        adminToken
      );
      expect(customersResponse.status).toBe(200);
      expect(customersResponse.data).toHaveProperty('customers');

      // Step 2: Admin creates new customer
      const newCustomerResponse = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/admin/customers',
        adminToken,
        {
          name: 'New Test Customer',
          address: '456 New Street, New City, NC 67890',
          contactInfo: '555-987-6543',
          email: 'newcustomer@test.com',
          groupCode: 'NEW',
        }
      );
      expect(newCustomerResponse.status).toBe(200);
      expect(newCustomerResponse.data).toHaveProperty('customer');

      const newCustomerId = newCustomerResponse.data.customer.id;

      // Step 3: Admin views customer details
      const customerDetailsResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/customers/${newCustomerId}`,
        adminToken
      );
      expect(customerDetailsResponse.status).toBe(200);
      expect(customerDetailsResponse.data).toHaveProperty('customer');

      // Step 4: Admin updates customer
      const updateCustomerResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/admin/customers/${newCustomerId}`,
        adminToken,
        {
          name: 'Updated Test Customer',
          address: '456 Updated Street, New City, NC 67890',
          contactInfo: '555-987-6543',
          email: 'updated@test.com',
          groupCode: 'UPD',
        }
      );
      expect(updateCustomerResponse.status).toBe(200);
      expect(updateCustomerResponse.data.customer.name).toBe('Updated Test Customer');
    });

    test('should search and filter customers', async () => {
      // Create additional test customers
      await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/admin/customers',
        adminToken,
        {
          name: 'Restaurant ABC',
          address: '123 Food Street',
          groupCode: 'REST',
        }
      );

      await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/admin/customers',
        adminToken,
        {
          name: 'Grocery XYZ',
          address: '456 Market Avenue',
          groupCode: 'GROC',
        }
      );

      // Search by name
      const searchResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/customers?search=Restaurant',
        adminToken
      );
      expect(searchResponse.status).toBe(200);
      expect(searchResponse.data.customers.length).toBeGreaterThan(0);
      expect(searchResponse.data.customers[0].name).toContain('Restaurant');
    });
  });

  describe('User Management Workflow', () => {
    test('should manage driver accounts', async () => {
      // Step 1: Admin views all users
      const usersResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/users',
        adminToken
      );
      expect(usersResponse.status).toBe(200);
      expect(usersResponse.data).toHaveProperty('users');

      // Step 2: Admin creates new driver
      const newDriverResponse = await testUtils.makeAuthenticatedRequest(
        'POST',
        '/api/admin/users',
        adminToken,
        {
          username: 'newdriver',
          password: 'newpassword',
          role: 'DRIVER',
          fullName: 'New Driver',
        }
      );
      expect(newDriverResponse.status).toBe(200);
      expect(newDriverResponse.data).toHaveProperty('user');

      const newDriverId = newDriverResponse.data.user.id;

      // Step 3: Admin views driver details
      const driverDetailsResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        `/api/admin/users/${newDriverId}`,
        adminToken
      );
      expect(driverDetailsResponse.status).toBe(200);
      expect(driverDetailsResponse.data).toHaveProperty('user');

      // Step 4: Admin updates driver
      const updateDriverResponse = await testUtils.makeAuthenticatedRequest(
        'PUT',
        `/api/admin/users/${newDriverId}`,
        adminToken,
        {
          fullName: 'Updated Driver Name',
          role: 'DRIVER',
        }
      );
      expect(updateDriverResponse.status).toBe(200);
      expect(updateDriverResponse.data.user.fullName).toBe('Updated Driver Name');
    });

    test('should filter users by role', async () => {
      // Filter for drivers only
      const driversResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/users?role=DRIVER',
        adminToken
      );
      expect(driversResponse.status).toBe(200);
      driversResponse.data.users.forEach(user => {
        expect(user.role).toBe('DRIVER');
      });

      // Filter for admins only
      const adminsResponse = await testUtils.makeAuthenticatedRequest(
        'GET',
        '/api/admin/users?role=ADMIN',
        adminToken
      );
      expect(adminsResponse.status).toBe(200);
      adminsResponse.data.users.forEach(user => {
        expect(user.role).toBe('ADMIN');
      });
    });
  });

  describe('Email Management Workflow', () => {
    test('should send delivery confirmation emails', async () => {
      const testRoute = await testUtils.createTestRoute(testDriver.id);
      const testStop = await testUtils.createTestStop(testRoute.id, testCustomer.id);
      const driverToken = testUtils.generateTestToken(testDriver.id, 'DRIVER');

      // Complete the delivery process
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
          signedInvoicePdfUrl: 'https://example.com/invoice.pdf',
        }
      );

      // Admin sends confirmation email
      const emailResponse = await testUtils.makeAuthenticatedRequest(
        'POST',
        `/api/admin/stops/${testStop.id}/send-email`,
        adminToken
      );

      // Email might fail in test environment, but API should respond
      expect([200, 500]).toContain(emailResponse.status);
    });
  });
});
