/**
 * Attendance API Client
 * 
 * Integrates with external attendance application to check driver clock-in status.
 * Implements caching, retry logic, and fallback modes for reliability.
 * 
 * Enforcement Modes:
 * - permissive: Log warnings only, don't block access
 * - warning: Show warnings to drivers, still allow access
 * - strict: Block access if not clocked in
 * 
 * Fallback Modes (when API is unavailable):
 * - permissive: Allow access with warning
 * - strict: Block access
 */

import prisma from "@/lib/db";

// Types
export interface AttendanceStatus {
  isClockedIn: boolean;
  clockInTime?: string;
  lastChecked: Date;
  source: "api" | "cache" | "fallback";
}

export interface AttendanceCheckResult {
  allowed: boolean;
  status: AttendanceStatus;
  message?: string;
  action?: "CLOCK_IN" | "CONTINUE" | "CONTACT_ADMIN";
}

// Configuration
const ATTENDANCE_ENABLED = process.env.ATTENDANCE_ENABLED === "true";
const ATTENDANCE_API_URL = process.env.ATTENDANCE_API_URL || "http://localhost:4000/api";
const ATTENDANCE_API_KEY = process.env.ATTENDANCE_API_KEY || "";
const CACHE_DURATION = parseInt(process.env.ATTENDANCE_STATUS_CACHE_DURATION || "300"); // 5 minutes default
const ENFORCEMENT_MODE = process.env.ATTENDANCE_ENFORCEMENT_MODE || "permissive"; // permissive | warning | strict
const FALLBACK_MODE = process.env.ATTENDANCE_API_FALLBACK_MODE || "permissive"; // permissive | strict

/**
 * Check if driver is clocked in via external attendance API
 */
export async function checkAttendanceStatus(
  userId: string,
  username: string
): Promise<AttendanceStatus> {
  // If attendance is disabled, return default "clocked in" status
  if (!ATTENDANCE_ENABLED) {
    return {
      isClockedIn: true,
      lastChecked: new Date(),
      source: "fallback",
    };
  }

  try {
    // Step 1: Check cache first
    const cachedStatus = await getCachedStatus(userId);
    if (cachedStatus) {
      console.log(`[Attendance] Using cached status for ${username}: ${cachedStatus.isClockedIn}`);
      return cachedStatus;
    }

    // Step 2: Call external attendance API
    console.log(`[Attendance] Fetching status from API for ${username}`);
    const apiStatus = await fetchAttendanceFromAPI(userId, username);

    // Step 3: Update cache
    await updateCache(userId, apiStatus.isClockedIn);

    return apiStatus;
  } catch (error) {
    console.error(`[Attendance] Error checking status for ${username}:`, error);

    // Step 4: Fallback - use last cached status or default
    return await getFallbackStatus(userId, username);
  }
}

/**
 * Get cached attendance status from database
 */
async function getCachedStatus(userId: string): Promise<AttendanceStatus | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        cachedClockInStatus: true,
        cachedClockInStatusAt: true,
        lastClockInStatusCheck: true,
      },
    });

    if (!user || !user.cachedClockInStatusAt) {
      return null;
    }

    // Check if cache is still valid
    const cacheAge = Date.now() - user.cachedClockInStatusAt.getTime();
    const cacheAgeSeconds = cacheAge / 1000;

    if (cacheAgeSeconds > CACHE_DURATION) {
      console.log(`[Attendance] Cache expired (${cacheAgeSeconds.toFixed(0)}s old)`);
      return null;
    }

    return {
      isClockedIn: user.cachedClockInStatus,
      lastChecked: user.cachedClockInStatusAt,
      source: "cache",
    };
  } catch (error) {
    console.error("[Attendance] Error reading cache:", error);
    return null;
  }
}

/**
 * Fetch attendance status from external API
 */
async function fetchAttendanceFromAPI(
  userId: string,
  username: string
): Promise<AttendanceStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(`${ATTENDANCE_API_URL}/attendance/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ATTENDANCE_API_KEY}`,
      },
      body: JSON.stringify({ userId, username }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      isClockedIn: data.isClockedIn || false,
      clockInTime: data.clockInTime,
      lastChecked: new Date(),
      source: "api",
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Update cached attendance status in database
 */
async function updateCache(userId: string, isClockedIn: boolean): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        cachedClockInStatus: isClockedIn,
        cachedClockInStatusAt: new Date(),
        lastClockInStatusCheck: new Date(),
      },
    });
  } catch (error) {
    console.error("[Attendance] Error updating cache:", error);
  }
}

/**
 * Get fallback status when API is unavailable
 */
async function getFallbackStatus(
  userId: string,
  username: string
): Promise<AttendanceStatus> {
  console.log(`[Attendance] Using fallback mode: ${FALLBACK_MODE}`);

  // Try to use last cached status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cachedClockInStatus: true,
      cachedClockInStatusAt: true,
    },
  });

  if (user && user.cachedClockInStatusAt) {
    console.log(`[Attendance] Using stale cache for ${username}`);
    return {
      isClockedIn: user.cachedClockInStatus,
      lastChecked: user.cachedClockInStatusAt,
      source: "fallback",
    };
  }

  // No cache available - use fallback mode default
  if (FALLBACK_MODE === "permissive") {
    console.log(`[Attendance] No cache, allowing access (permissive fallback)`);
    return {
      isClockedIn: true, // Assume clocked in
      lastChecked: new Date(),
      source: "fallback",
    };
  } else {
    console.log(`[Attendance] No cache, blocking access (strict fallback)`);
    return {
      isClockedIn: false, // Assume not clocked in
      lastChecked: new Date(),
      source: "fallback",
    };
  }
}

/**
 * Check if driver should be allowed access based on attendance status
 * This is the main function used by middleware
 */
export async function checkDriverAccess(
  userId: string,
  username: string
): Promise<AttendanceCheckResult> {
  const status = await checkAttendanceStatus(userId, username);

  // Enforcement logic based on mode
  switch (ENFORCEMENT_MODE) {
    case "permissive":
      // Always allow, just log
      if (!status.isClockedIn) {
        console.warn(`[Attendance] Driver ${username} not clocked in (permissive mode - allowing)`);
      }
      return {
        allowed: true,
        status,
        message: status.isClockedIn
          ? "You are clocked in"
          : "Warning: You are not clocked in. Please clock in at the attendance app.",
      };

    case "warning":
      // Allow but show warning
      return {
        allowed: true,
        status,
        message: status.isClockedIn
          ? "You are clocked in"
          : "⚠️ WARNING: You are not clocked in. Please clock in soon to avoid access restrictions.",
        action: status.isClockedIn ? "CONTINUE" : "CLOCK_IN",
      };

    case "strict":
      // Block if not clocked in
      if (!status.isClockedIn) {
        console.warn(`[Attendance] Blocking ${username} - not clocked in (strict mode)`);
        return {
          allowed: false,
          status,
          message: "You must clock in before accessing routes. Please use the attendance app to clock in.",
          action: "CLOCK_IN",
        };
      }
      return {
        allowed: true,
        status,
        message: "You are clocked in",
        action: "CONTINUE",
      };

    default:
      // Default to permissive
      console.warn(`[Attendance] Unknown enforcement mode: ${ENFORCEMENT_MODE}, defaulting to permissive`);
      return {
        allowed: true,
        status,
      };
  }
}

/**
 * Manually refresh attendance status (bypass cache)
 */
export async function refreshAttendanceStatus(
  userId: string,
  username: string
): Promise<AttendanceStatus> {
  try {
    console.log(`[Attendance] Manual refresh for ${username}`);
    const apiStatus = await fetchAttendanceFromAPI(userId, username);
    await updateCache(userId, apiStatus.isClockedIn);
    return apiStatus;
  } catch (error) {
    console.error(`[Attendance] Error refreshing status:`, error);
    return await getFallbackStatus(userId, username);
  }
}

