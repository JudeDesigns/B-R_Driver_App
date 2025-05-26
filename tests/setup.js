/**
 * Test setup and configuration
 */

const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

// Create a test database instance
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

// Test utilities
const testUtils = {
  // Create a test admin user
  async createTestAdmin() {
    const hashedPassword = await argon2.hash("testpassword");

    // Try to find existing user first
    const existingUser = await prisma.user.findUnique({
      where: { username: "testadmin" },
    });

    if (existingUser) {
      return existingUser;
    }

    return await prisma.user.create({
      data: {
        username: "testadmin",
        password: hashedPassword,
        role: "ADMIN",
        fullName: "Test Administrator",
      },
    });
  },

  // Create a test driver user
  async createTestDriver() {
    const hashedPassword = await argon2.hash("testpassword");

    // Try to find existing user first
    const existingUser = await prisma.user.findUnique({
      where: { username: "testdriver" },
    });

    if (existingUser) {
      return existingUser;
    }

    return await prisma.user.create({
      data: {
        username: "testdriver",
        password: hashedPassword,
        role: "DRIVER",
        fullName: "Test Driver",
      },
    });
  },

  // Create a test customer
  async createTestCustomer() {
    // Try to find existing customer first
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        name: "Test Restaurant",
        email: "test@restaurant.com",
      },
    });

    if (existingCustomer) {
      return existingCustomer;
    }

    return await prisma.customer.create({
      data: {
        name: "Test Customer",
        address: "123 Test Street, Test City, TC 12345",
        contactInfo: "555-123-4567",
        email: "test@customer.com",
        groupCode: "TEST",
      },
    });
  },

  // Create a test route
  async createTestRoute(driverId) {
    // Try to find existing route first
    const existingRoute = await prisma.route.findFirst({
      where: {
        routeNumber: "TEST001",
        driverId: driverId,
      },
    });

    if (existingRoute) {
      return existingRoute;
    }

    return await prisma.route.create({
      data: {
        routeNumber: "TEST001",
        date: new Date(),
        status: "PENDING",
        driverId: driverId,
      },
    });
  },

  // Create a test stop
  async createTestStop(routeId, customerId) {
    return await prisma.stop.create({
      data: {
        routeId: routeId,
        customerId: customerId,
        sequence: 1,
        status: "PENDING",
        driverNameFromUpload: "Test Driver",
        customerNameFromUpload: "Test Customer",
        orderNumberWeb: "TEST001",
        quickbooksInvoiceNum: "QB001",
        address: "123 Test Street, Test City, TC 12345",
      },
    });
  },

  // Clean up test data
  async cleanup() {
    // Delete in reverse order of dependencies
    await prisma.return.deleteMany({});
    await prisma.adminNote.deleteMany({});
    await prisma.customerEmail.deleteMany({});
    await prisma.safetyCheck.deleteMany({});
    await prisma.stop.deleteMany({});
    await prisma.route.deleteMany({});
    await prisma.routeUpload.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        username: {
          in: ["testadmin", "testdriver"],
        },
      },
    });
  },

  // Generate JWT token for testing
  generateTestToken(userId, role) {
    const jwt = require("jsonwebtoken");
    return jwt.sign(
      { id: userId, role: role },
      process.env.JWT_SECRET || "test-secret",
      { expiresIn: "1h" }
    );
  },

  // Make authenticated API request
  async makeAuthenticatedRequest(method, url, token, body = null) {
    // Use Node.js built-in fetch (available in Node 18+)
    const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${baseUrl}${url}`, options);

    let data = {};
    try {
      const text = await response.text();
      if (text) {
        data = JSON.parse(text);
      }
    } catch (error) {
      // If JSON parsing fails, return empty object
      data = { error: "Failed to parse response" };
    }

    return {
      status: response.status,
      data,
      ok: response.ok,
    };
  },
};

// Global test setup
beforeAll(async () => {
  // Ensure database connection
  await prisma.$connect();
});

// Global test cleanup
afterAll(async () => {
  await testUtils.cleanup();
  await prisma.$disconnect();
});

// Clean up after each test
afterEach(async () => {
  await testUtils.cleanup();
});

module.exports = {
  prisma,
  testUtils,
};
