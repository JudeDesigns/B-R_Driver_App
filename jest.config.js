/**
 * Jest configuration for B&R Food Services testing
 */

module.exports = {
  // Test environment
  testEnvironment: "node",

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],

  // Test file patterns
  testMatch: ["<rootDir>/tests/**/*.test.js", "<rootDir>/tests/**/*.spec.js"],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  collectCoverageFrom: [
    "src/**/*.{js,ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{js,ts,tsx}",
    "!src/**/node_modules/**",
  ],

  // Module name mapping for Next.js
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Transform configuration
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": ["babel-jest", { presets: ["next/babel"] }],
  },

  // Transform node_modules that use ES modules
  transformIgnorePatterns: [
    "node_modules/(?!(node-fetch|fetch-blob|data-uri-to-buffer|formdata-polyfill)/)",
  ],

  // Module file extensions
  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Global variables
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },

  // Environment variables for testing
  setupFiles: ["<rootDir>/tests/env.setup.js"],
};
