/**
 * Utility functions for route management
 * Extracted from route details page to improve modularity
 */

/**
 * Format a date string to a readable format in PST timezone
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format a date-time string to a readable format in PST timezone
 */
export const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
};

/**
 * Get CSS classes for status badges based on status
 */
export const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "ON_THE_WAY":
      return "bg-blue-100 text-blue-800";
    case "ARRIVED":
      return "bg-purple-100 text-purple-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "CANCELLED":
      return "bg-red-100 text-red-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

/**
 * Interface for Stop data used in payment method calculation
 */
interface StopPaymentData {
  driverPaymentMethods?: string[];
  driverPaymentAmount?: number;
  paymentFlagCash?: boolean;
  paymentFlagCheck?: boolean;
  paymentFlagCC?: boolean;
  paymentFlagNotPaid?: boolean;
}

/**
 * Get payment method display string for a stop
 */
export const getPaymentMethod = (stop: StopPaymentData): string => {
  // Check if driver has recorded payments (priority)
  if (stop.driverPaymentMethods && stop.driverPaymentMethods.length > 0) {
    return stop.driverPaymentMethods.join(", ");
  }

  // Check if driver recorded payment amount without methods
  if (stop.driverPaymentAmount && stop.driverPaymentAmount > 0) {
    return "Paid";
  }

  // Check legacy payment flags from Excel
  const flags = [];
  if (stop.paymentFlagCash) flags.push("Cash");
  if (stop.paymentFlagCheck) flags.push("Check");
  if (stop.paymentFlagCC) flags.push("Credit Card");

  if (flags.length > 0) return flags.join(", ");
  if (stop.paymentFlagNotPaid) return "Not Paid";
  return "Not Paid";
};

/**
 * Interface for Stop data used in calculations
 */
interface StopCalculationData {
  amount?: number | null;
  driverPaymentAmount?: number;
  totalPaymentAmount?: number;
}

/**
 * Calculate total amount for stops
 */
export const getTotalAmount = (stops: StopCalculationData[]): number => {
  return stops.reduce((total, stop) => total + (stop.amount || 0), 0);
};

/**
 * Calculate total payment amount for stops
 */
export const getTotalPaymentAmount = (stops: StopCalculationData[]): number => {
  return stops.reduce((total, stop) => {
    // Prioritize driver-recorded payments over Excel amounts
    return total + (stop.driverPaymentAmount || stop.totalPaymentAmount || 0);
  }, 0);
};
