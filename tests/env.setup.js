/**
 * Environment setup for tests
 */

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-key-for-testing-only";

// Use the correct database URL for testing
process.env.DATABASE_URL =
  "postgresql://postgres:root@localhost:5432/br_food_services";

process.env.TEST_BASE_URL = "http://localhost:3000";

// Email configuration for testing
process.env.EMAIL_HOST = "smtp.ethereal.email";
process.env.EMAIL_PORT = "587";
process.env.EMAIL_USER = "test@example.com";
process.env.EMAIL_PASS = "testpassword";
process.env.EMAIL_FROM = "test@brfoodservices.com";
process.env.EMAIL_SECURE = "false";

// Disable console logs during testing (optional)
if (process.env.SILENT_TESTS === "true") {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
}
