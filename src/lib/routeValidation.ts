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

  // Convert to uppercase for case-insensitive comparison
  const upperName = customerName.toUpperCase().trim();

  // Check for email addresses (contains @)
  if (customerName.includes("@")) {
    return true;
  }

  // Check for specific administrative/documentation entries that should be skipped
  const skipPatterns = [
    "END OF ROUTE – POST-TRIP DOCUMENTATION",
    "END OF ROUTE - POST-TRIP DOCUMENTATION", // Alternative dash format
    "BREAK COMPLIANCE – CALIFORNIA LAW",
    "BREAK COMPLIANCE - CALIFORNIA LAW", // Alternative dash format
    "END OF ROUTE – POST-TRIP DOCUMENTATION", // Exact match from requirement
    "ALL P.O",
    "Fueling Procedures – Gasoline Vans",
    "Fueling Procedures – Diesel Trucks",
    "Start of Route – Driver Preparation & Documentation"
  ];

  // Check if the customer name matches any of the skip patterns
  for (const pattern of skipPatterns) {
    if (upperName === pattern.toUpperCase()) {
      return true;
    }
  }

  // Additional flexible matching for variations in spacing/punctuation
  const normalizedName = upperName.replace(/[–\-\s]+/g, ' ').trim();
  const flexiblePatterns = [
    "END OF ROUTE POST TRIP DOCUMENTATION",
    "BREAK COMPLIANCE CALIFORNIA LAW"
  ];

  for (const pattern of flexiblePatterns) {
    if (normalizedName === pattern) {
      return true;
    }
  }

  return false;
}