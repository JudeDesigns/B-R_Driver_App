/**
 * Attendance Middleware
 * 
 * Middleware to check driver attendance status before allowing access to routes/stops.
 * Supports multiple enforcement modes for gradual rollout.
 * 
 * Usage:
 * import { requireActiveShift } from "@/lib/attendanceMiddleware";
 * 
 * export async function GET(request: NextRequest) {
 *   const attendanceCheck = await requireActiveShift(request);
 *   if (!attendanceCheck.allowed) {
 *     return NextResponse.json(attendanceCheck.error, { status: attendanceCheck.status });
 *   }
 *   const { decoded } = attendanceCheck;
 *   // ... rest of your handler
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { checkDriverAccess } from "@/lib/attendanceClient";

export interface AttendanceMiddlewareResult {
  allowed: boolean;
  decoded?: any;
  error?: {
    error: string;
    message: string;
    nextAction?: string;
    clockInUrl?: string;
    attendanceAppUrl?: string;
  };
  status?: number;
}

/**
 * Middleware to require active shift (clocked in) for driver operations
 * 
 * This middleware:
 * 1. Verifies JWT authentication
 * 2. Checks if user is a DRIVER
 * 3. Checks attendance status via external API
 * 4. Returns appropriate response based on enforcement mode
 * 
 * @param request - Next.js request object
 * @returns Middleware result with allowed status and decoded token or error
 */
export async function requireActiveShift(
  request: NextRequest
): Promise<AttendanceMiddlewareResult> {
  try {
    // Step 1: Verify JWT authentication (existing logic)
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        allowed: false,
        error: {
          error: "UNAUTHORIZED",
          message: "Unauthorized - No valid token provided",
        },
        status: 401,
      };
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return {
        allowed: false,
        error: {
          error: "UNAUTHORIZED",
          message: "Unauthorized - Invalid token",
        },
        status: 401,
      };
    }

    // Step 2: Check if user is a driver (only drivers need attendance checks)
    if (decoded.role !== "DRIVER") {
      // Admins and super admins bypass attendance checks
      return {
        allowed: true,
        decoded,
      };
    }

    // Step 3: Check attendance status
    const attendanceCheck = await checkDriverAccess(decoded.id, decoded.username);

    // Step 4: Handle based on enforcement mode
    if (!attendanceCheck.allowed) {
      // Strict mode - block access
      console.warn(
        `[Attendance Middleware] Blocking driver ${decoded.username} - not clocked in`
      );
      return {
        allowed: false,
        error: {
          error: "NO_ACTIVE_SHIFT",
          message: attendanceCheck.message || "You must clock in before accessing routes",
          nextAction: "CLOCK_IN",
          attendanceAppUrl: process.env.ATTENDANCE_API_URL || "http://localhost:4000",
        },
        status: 403,
      };
    }

    // Allowed - but may have warning message
    if (attendanceCheck.message && attendanceCheck.action === "CLOCK_IN") {
      console.warn(
        `[Attendance Middleware] Warning for driver ${decoded.username}: ${attendanceCheck.message}`
      );
    }

    return {
      allowed: true,
      decoded,
    };
  } catch (error) {
    console.error("[Attendance Middleware] Error:", error);
    
    // On error, check fallback mode
    const fallbackMode = process.env.ATTENDANCE_API_FALLBACK_MODE || "permissive";
    
    if (fallbackMode === "strict") {
      return {
        allowed: false,
        error: {
          error: "ATTENDANCE_CHECK_FAILED",
          message: "Unable to verify attendance status. Please contact administrator.",
          nextAction: "CONTACT_ADMIN",
        },
        status: 503,
      };
    }
    
    // Permissive fallback - allow access but log error
    console.warn("[Attendance Middleware] Allowing access due to error (permissive fallback)");
    
    // Still need to verify basic auth
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token) as any;
      
      return {
        allowed: true,
        decoded,
      };
    }
    
    return {
      allowed: false,
      error: {
        error: "UNAUTHORIZED",
        message: "Unauthorized",
      },
      status: 401,
    };
  }
}

