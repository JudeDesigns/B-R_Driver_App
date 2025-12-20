/**
 * Test file for route validation functions
 * Ensures new skip functionality doesn't break existing behavior
 */

import { shouldIgnoreCustomer, shouldIgnoreDriver } from '../routeValidation';

describe('shouldIgnoreCustomer', () => {
  // Test existing functionality (email addresses)
  describe('existing email validation', () => {
    test('should ignore email addresses', () => {
      expect(shouldIgnoreCustomer('test@example.com')).toBe(true);
      expect(shouldIgnoreCustomer('user@domain.org')).toBe(true);
      expect(shouldIgnoreCustomer('customer@business.net')).toBe(true);
    });

    test('should not ignore valid customer names', () => {
      expect(shouldIgnoreCustomer('John Doe')).toBe(false);
      expect(shouldIgnoreCustomer('ABC Company')).toBe(false);
      expect(shouldIgnoreCustomer('Restaurant Supply Co')).toBe(false);
    });

    test('should ignore empty or null customer names', () => {
      expect(shouldIgnoreCustomer('')).toBe(true);
      expect(shouldIgnoreCustomer(null as any)).toBe(true);
      expect(shouldIgnoreCustomer(undefined as any)).toBe(true);
    });
  });

  // Test new functionality (documentation entries)
  describe('new documentation entry validation', () => {
    test('should ignore exact documentation entries', () => {
      expect(shouldIgnoreCustomer('End of Route – Post-Trip Documentation')).toBe(true);
      expect(shouldIgnoreCustomer('Break Compliance – California Law')).toBe(true);
      expect(shouldIgnoreCustomer('END OF ROUTE – POST-TRIP DOCUMENTATION')).toBe(true);
    });

    test('should ignore alternative dash formats', () => {
      expect(shouldIgnoreCustomer('End of Route - Post-Trip Documentation')).toBe(true);
      expect(shouldIgnoreCustomer('Break Compliance - California Law')).toBe(true);
    });

    test('should ignore case variations', () => {
      expect(shouldIgnoreCustomer('end of route – post-trip documentation')).toBe(true);
      expect(shouldIgnoreCustomer('BREAK COMPLIANCE – CALIFORNIA LAW')).toBe(true);
      expect(shouldIgnoreCustomer('End Of Route – Post-Trip Documentation')).toBe(true);
    });

    test('should ignore spacing/punctuation variations', () => {
      expect(shouldIgnoreCustomer('End of Route  –  Post-Trip Documentation')).toBe(true);
      expect(shouldIgnoreCustomer('Break Compliance  –  California Law')).toBe(true);
      expect(shouldIgnoreCustomer('End of Route–Post-Trip Documentation')).toBe(true);
    });

    test('should not ignore similar but different customer names', () => {
      expect(shouldIgnoreCustomer('End of Route Restaurant')).toBe(false);
      expect(shouldIgnoreCustomer('California Law Firm')).toBe(false);
      expect(shouldIgnoreCustomer('Post-Trip Catering')).toBe(false);
      expect(shouldIgnoreCustomer('Break Time Cafe')).toBe(false);
    });
  });
});

describe('shouldIgnoreDriver', () => {
  // Test that existing driver validation still works
  test('should ignore invalid driver names', () => {
    expect(shouldIgnoreDriver('INV123')).toBe(true);
    expect(shouldIgnoreDriver('CRM456')).toBe(true);
    expect(shouldIgnoreDriver('test@email.com')).toBe(true);
    expect(shouldIgnoreDriver('LUIS')).toBe(true);
    expect(shouldIgnoreDriver('BARAK')).toBe(true);
    expect(shouldIgnoreDriver('ADMIN')).toBe(true);
  });

  test('should not ignore valid driver names', () => {
    expect(shouldIgnoreDriver('John Smith')).toBe(false);
    expect(shouldIgnoreDriver('Maria Garcia')).toBe(false);
    expect(shouldIgnoreDriver('Mike Johnson')).toBe(false);
  });

  test('should ignore empty driver names', () => {
    expect(shouldIgnoreDriver('')).toBe(true);
    expect(shouldIgnoreDriver(null as any)).toBe(true);
    expect(shouldIgnoreDriver(undefined as any)).toBe(true);
  });
});

// Integration test to ensure the functions work together
describe('integration tests', () => {
  test('should handle mixed valid and invalid entries', () => {
    const testEntries = [
      { name: 'Valid Customer', shouldIgnore: false },
      { name: 'test@email.com', shouldIgnore: true },
      { name: 'End of Route – Post-Trip Documentation', shouldIgnore: true },
      { name: 'Another Valid Customer', shouldIgnore: false },
      { name: 'Break Compliance – California Law', shouldIgnore: true },
    ];

    testEntries.forEach(entry => {
      expect(shouldIgnoreCustomer(entry.name)).toBe(entry.shouldIgnore);
    });
  });
});
