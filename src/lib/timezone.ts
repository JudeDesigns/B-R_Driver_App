// Timezone utility for B&R Driver App
// Handles PST/PDT timezone conversions for San Francisco client

/**
 * Get the current date in PST/PDT timezone
 * This automatically handles daylight saving time
 */
export function getPSTDate(): Date {
  const now = new Date();
  // Convert to PST/PDT (America/Los_Angeles timezone)
  const pstDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return pstDate;
}

/**
 * Get today's date range in PST timezone
 * Returns start and end of day in PST
 */
export function getPSTDateRange(): { start: Date; end: Date } {
  const pstNow = getPSTDate();
  
  // Start of day in PST
  const start = new Date(pstNow);
  start.setHours(0, 0, 0, 0);
  
  // End of day in PST
  const end = new Date(pstNow);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Convert a date to PST timezone for display
 */
export function formatDatePST(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Convert a date to PST timezone with time for display
 */
export function formatDateTimePST(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });
}

/**
 * Get a date string in YYYY-MM-DD format for PST timezone
 * Useful for database queries and comparisons
 */
export function getPSTDateString(date?: Date | string): string {
  const dateObj = date ? (typeof date === 'string' ? new Date(date) : date) : getPSTDate();
  
  // Get the date in PST timezone
  const pstDateString = dateObj.toLocaleDateString("en-CA", { 
    timeZone: "America/Los_Angeles" 
  }); // en-CA gives YYYY-MM-DD format
  
  return pstDateString;
}

/**
 * Check if a date is "today" in PST timezone
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const todayPST = getPSTDateString();
  const datePST = getPSTDateString(dateObj);
  
  return todayPST === datePST;
}

/**
 * Get the start of today in UTC but based on PST timezone
 * This is useful for database queries where dates are stored in UTC
 */
export function getTodayStartUTC(): Date {
  const pstRange = getPSTDateRange();
  // Convert PST start time back to UTC for database queries
  return new Date(pstRange.start.toISOString());
}

/**
 * Get the end of today in UTC but based on PST timezone
 */
export function getTodayEndUTC(): Date {
  const pstRange = getPSTDateRange();
  // Convert PST end time back to UTC for database queries
  return new Date(pstRange.end.toISOString());
}

/**
 * Create a date object for "today" in PST timezone
 * This ensures routes uploaded "today" are correctly dated for PST users
 */
export function createPSTDate(year?: number, month?: number, day?: number): Date {
  if (year && month && day) {
    // Create date in PST timezone
    const pstDate = new Date();
    pstDate.setFullYear(year, month - 1, day); // month is 0-indexed
    pstDate.setHours(12, 0, 0, 0); // Set to noon PST to avoid timezone edge cases
    
    // Convert to PST timezone
    const pstString = pstDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    return new Date(pstString);
  }
  
  return getPSTDate();
}

/**
 * Format date for route display (PST timezone)
 */
export function formatRouteDate(date: Date | string): string {
  return formatDatePST(date);
}

/**
 * Format datetime for stop completion times (PST timezone)
 */
export function formatStopDateTime(date: Date | string | null): string {
  if (!date) return "N/A";
  return formatDateTimePST(date);
}

/**
 * Get timezone info for display
 */
export function getTimezoneInfo(): { name: string; abbreviation: string; offset: string } {
  const now = new Date();
  const pstTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  
  // Check if we're in daylight saving time
  const isDST = now.getTimezoneOffset() < new Date(now.getFullYear(), 0, 1).getTimezoneOffset();
  
  return {
    name: "America/Los_Angeles",
    abbreviation: isDST ? "PDT" : "PST",
    offset: isDST ? "UTC-7" : "UTC-8"
  };
}
