// Timezone utility for B&R Driver App
// Handles PST/PDT timezone conversions for San Francisco client

/**
 * Get the current date in PST/PDT timezone
 * This automatically handles daylight saving time
 * Returns a Date object that represents the current moment in time (UTC internally)
 */
export function getPSTDate(): Date {
  // Simply return the current UTC time - timestamps should always be in UTC
  // The timezone conversion should only happen during display, not storage
  return new Date();
}

/**
 * Get today's date range in PST timezone
 * Returns start and end of day in PST, converted to UTC for database queries
 */
export function getPSTDateRange(): { start: Date; end: Date } {
  const now = new Date();

  // Get current date in PST timezone
  const pstDateString = now.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  }); // YYYY-MM-DD format

  // Create start of day in PST (00:00:00 PST)
  const startPST = new Date(`${pstDateString}T00:00:00`);
  // Convert PST time to UTC by adding PST offset
  const pstOffset = getPSTOffset();
  const start = new Date(startPST.getTime() - (pstOffset * 60 * 60 * 1000));

  // Create end of day in PST (23:59:59.999 PST)
  const endPST = new Date(`${pstDateString}T23:59:59.999`);
  const end = new Date(endPST.getTime() - (pstOffset * 60 * 60 * 1000));

  return { start, end };
}

/**
 * Get PST offset in hours (8 for PST, 7 for PDT)
 */
function getPSTOffset(): number {
  const now = new Date();
  const january = new Date(now.getFullYear(), 0, 1);
  const july = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdOffset;
  return isDST ? 7 : 8; // PDT is UTC-7, PST is UTC-8
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
  const dateObj = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();

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
  return pstRange.start;
}

/**
 * Get the end of today in UTC but based on PST timezone
 */
export function getTodayEndUTC(): Date {
  const pstRange = getPSTDateRange();
  return pstRange.end;
}

/**
 * Create a date object for "today" in PST timezone
 * This ensures routes uploaded "today" are correctly dated for PST users
 */
export function createPSTDate(year?: number, month?: number, day?: number): Date {
  if (year && month && day) {
    // Create date at noon PST and convert to UTC
    const pstDateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00`;
    const tempDate = new Date(pstDateString);
    const pstOffset = getPSTOffset();
    return new Date(tempDate.getTime() - (pstOffset * 60 * 60 * 1000));
  }

  return new Date(); // Return current UTC time
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

  // Check if we're in daylight saving time for PST/PDT
  const january = new Date(now.getFullYear(), 0, 1);
  const july = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < stdOffset;

  return {
    name: "America/Los_Angeles",
    abbreviation: isDST ? "PDT" : "PST",
    offset: isDST ? "UTC-7" : "UTC-8"
  };
}
