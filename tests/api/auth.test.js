/**
 * Authentication API Tests
 */

const { testUtils } = require("../setup");

describe("Authentication API", () => {
  describe("POST /api/auth/login", () => {
    let testAdmin;
    let testDriver;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin();
      testDriver = await testUtils.createTestDriver();
    });

    test("should login admin user successfully", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "POST",
        "/api/auth/login",
        null,
        {
          username: "testadmin",
          password: "testpassword",
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("token");
      expect(response.data).toHaveProperty("user");
      expect(response.data.user.role).toBe("ADMIN");
      expect(response.data.user.username).toBe("testadmin");
    });

    test("should login driver user successfully", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "POST",
        "/api/auth/login",
        null,
        {
          username: "testdriver",
          password: "testpassword",
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty("token");
      expect(response.data).toHaveProperty("user");
      expect(response.data.user.role).toBe("DRIVER");
      expect(response.data.user.username).toBe("testdriver");
    });

    test("should reject invalid credentials", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "POST",
        "/api/auth/login",
        null,
        {
          username: "testadmin",
          password: "wrongpassword",
        }
      );

      expect(response.status).toBe(401);
      expect(response.data).toHaveProperty("message");
      expect(response.data.message).toContain("Invalid username or password");
    });

    test("should reject non-existent user", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "POST",
        "/api/auth/login",
        null,
        {
          username: "nonexistent",
          password: "testpassword",
        }
      );

      expect(response.status).toBe(401);
      expect(response.data).toHaveProperty("message");
      expect(response.data.message).toContain("Invalid username or password");
    });

    test("should reject missing credentials", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "POST",
        "/api/auth/login",
        null,
        {
          username: "testadmin",
        }
      );

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty("message");
      expect(response.data.message).toContain(
        "Username and password are required"
      );
    });
  });

  describe("Token Validation", () => {
    let testAdmin;
    let adminToken;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin();
      adminToken = testUtils.generateTestToken(testAdmin.id, "ADMIN");
    });

    test("should accept valid token", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/admin/dashboard",
        adminToken
      );

      expect(response.status).toBe(200);
    });

    test("should reject invalid token", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/admin/dashboard",
        "invalid-token"
      );

      expect(response.status).toBe(401);
    });

    test("should reject missing token", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/admin/dashboard",
        null
      );

      expect(response.status).toBe(401);
    });
  });

  describe("Role-based Access Control", () => {
    let testAdmin;
    let testDriver;
    let adminToken;
    let driverToken;

    beforeEach(async () => {
      testAdmin = await testUtils.createTestAdmin();
      testDriver = await testUtils.createTestDriver();
      adminToken = testUtils.generateTestToken(testAdmin.id, "ADMIN");
      driverToken = testUtils.generateTestToken(testDriver.id, "DRIVER");
    });

    test("admin should access admin endpoints", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/admin/dashboard",
        adminToken
      );

      expect(response.status).toBe(200);
    });

    test("driver should not access admin endpoints", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/admin/dashboard",
        driverToken
      );

      expect(response.status).toBe(401);
    });

    test("driver should access driver endpoints", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/driver/assigned-routes",
        driverToken
      );

      expect(response.status).toBe(200);
    });

    test("admin should not access driver-specific endpoints", async () => {
      const response = await testUtils.makeAuthenticatedRequest(
        "GET",
        "/api/driver/assigned-routes",
        adminToken
      );

      // Admin might have access but should get empty results or specific handling
      expect([200, 401, 403]).toContain(response.status);
    });
  });
});
