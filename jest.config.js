const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Path to Next.js app to load next.config.js and .env files
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/driver-name-matching.test.js',
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/src/**/*.test.[jt]s?(x)',
  ],
};

module.exports = createJestConfig(customJestConfig);
