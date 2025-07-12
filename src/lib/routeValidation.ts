/**
 * Route validation utilities
 * Extracted from routeParser.ts for better modularity
 */

/**
 * Check if a driver name should be ignored
 * @param driverName The driver name to check
 * @returns True if the driver name should be ignored, false otherwise
 */
export function shouldIgnoreDriver(driverName: string): boolean {
  if (!driverName) return true;

  // Convert to uppercase for case-insensitive comparison
  const upperName = driverName.toUpperCase();

  // Check for specific strings that indicate this is not a valid driver
  if (
    upperName.includes("INV") ||
    upperName.includes("CRM") ||
    upperName.includes("@") ||
    upperName.includes("CUSTOMER") ||
    upperName === "LUIS" ||
    upperName === "BARAK" ||
    upperName === "KHIARA" ||
    upperName.includes("BARAK CUSTOMER") ||
    // Add more specific names to ignore if needed
    upperName.includes("ADMIN") ||
    upperName.includes("TEST") ||
    upperName.includes("UNKNOWN")
  ) {
    return true;
  }

  // Check if the name contains any non-alphabetic characters (except spaces and hyphens)
  // This helps filter out names that might be codes or other non-name strings
  const validNamePattern = /^[A-Za-z\s\-]+$/;
  if (!validNamePattern.test(driverName)) {
    return true;
  }

  return false;
}

/**
 * Check if a customer name should be ignored
 * @param customerName The customer name to check
 * @returns True if the customer name should be ignored, false otherwise
 */
export function shouldIgnoreCustomer(customerName: string): boolean {
  if (!customerName) return true;

  // Check for email addresses (contains @)
  if (customerName.includes("@")) {
    return true;
  }

  return false;
}