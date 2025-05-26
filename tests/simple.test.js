/**
 * Simple test to verify Jest is working
 * This test does NOT use database setup
 */

// Don't import the setup file for this test
describe("Basic Test Suite", () => {
  test("should run basic tests", () => {
    expect(1 + 1).toBe(2);
  });

  test("should test environment variables", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  test("should test basic JavaScript functionality", () => {
    const testObject = { name: "test", value: 123 };
    expect(testObject.name).toBe("test");
    expect(testObject.value).toBe(123);
  });

  test("should test async functionality", async () => {
    const promise = Promise.resolve("test");
    const result = await promise;
    expect(result).toBe("test");
  });
});
