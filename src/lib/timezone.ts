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

  // Create start of day in PST timezone using proper timezone-aware construction
  const startPSTString = `${pstDateString}T00:00:00.000-08:00`; // Always use PST offset for consistency
  const start = new Date(startPSTString);

  // Adjust for PDT if needed (PDT is UTC-7, PST is UTC-8)
  const isDST = isCurrentlyDST();
  if (isDST) {
    // If we're in PDT, add 1 hour to convert from PST to PDT
    start.setHours(start.getHours() + 1);
  }

  // Create end of day in PST timezone
  const endPSTString = `${pstDateString}T23:59:59.999-08:00`; // Always use PST offset for consistency
  const end = new Date(endPSTString);

  // Adjust for PDT if needed
  if (isDST) {
    // If we're in PDT, add 1 hour to convert from PST to PDT
    end.setHours(end.getHours() + 1);
  }

  return { start, end };
}

/**
 * Get PST offset in hours (8 for PST, 7 for PDT)
 */
function getPSTOffset(): number {
  return isCurrentlyDST() ? 7 : 8; // PDT is UTC-7, PST is UTC-8
}

/**
 * Check if we're currently in Daylight Saving Time (PDT)
 */
function isCurrentlyDST(): boolean {
  const now = new Date();
  const january = new Date(now.getFullYear(), 0, 1);
  const july = new Date(now.getFullYear(), 6, 1);
  const stdOffset = Math.max(january.getTimezoneOffset(), july.getTimezoneOffset());
  return now.getTimezoneOffset() < stdOffset;
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
    // Create date at noon PST using proper timezone-aware construction
    const pstDateString = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000-08:00`;
    const date = new Date(pstDateString);

    // Adjust for PDT if needed
    if (isCurrentlyDST()) {
      date.setHours(date.getHours() + 1);
    }

    return date;
  }

  // For "today" case, get the current date in PST timezone and set to start of day
  const now = new Date();
  const pstDateString = now.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  });

  // Create start of day in PST timezone
  const startOfDayPST = `${pstDateString}T00:00:00.000-08:00`;
  const date = new Date(startOfDayPST);

  // Adjust for PDT if needed
  if (isCurrentlyDST()) {
    date.setHours(date.getHours() + 1);
  }

  return date;
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
  const isDST = isCurrentlyDST();

  return {
    name: "America/Los_Angeles",
    abbreviation: isDST ? "PDT" : "PST",
    offset: isDST ? "UTC-7" : "UTC-8"
  };
}

/**
 * Create a PST date from a date string (YYYY-MM-DD format)
 * Ensures the date represents the correct day in PST timezone
 */
export function createPSTDateFromString(dateString: string): Date {
  // Parse the date string (YYYY-MM-DD)
  const [year, month, day] = dateString.split('-').map(Number);
  return createPSTDate(year, month, day);
}

/**
 * Convert any date to start of day in PST timezone
 */
export function toPSTStartOfDay(date: Date): Date {
  const pstDateString = date.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  });

  return createPSTDateFromString(pstDateString);
}

/**
 * Convert any date to end of day in PST timezone
 */
export function toPSTEndOfDay(date: Date): Date {
  const pstDateString = date.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  });

  // Create end of day in PST timezone
  const endOfDayPST = `${pstDateString}T23:59:59.999-08:00`;
  const endDate = new Date(endOfDayPST);

  // Adjust for PDT if needed
  if (isCurrentlyDST()) {
    endDate.setHours(endDate.getHours() + 1);
  }

  return endDate;
}

/**
 * Debug function to log timezone conversion details
 */
export function debugTimezoneConversion(label: string, date: Date): void {
  const utcString = date.toISOString();
  const pstString = date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  console.log(`[TIMEZONE DEBUG] ${label}:`);
  console.log(`  UTC: ${utcString}`);
  console.log(`  PST: ${pstString}`);
  console.log(`  DST: ${isCurrentlyDST() ? 'Yes (PDT)' : 'No (PST)'}`);
}
