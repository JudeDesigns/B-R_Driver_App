import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { checkAttendanceStatus, refreshAttendanceStatus } from "@/lib/attendanceClient";

/**
 * GET /api/driver/attendance/status
 * 
 * Get current attendance status for the authenticated driver
 * Returns clock-in status, last check time, and enforcement mode info
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check if refresh is requested
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "true";

    // Get attendance status
    const status = refresh
      ? await refreshAttendanceStatus(decoded.id, decoded.username)
      : await checkAttendanceStatus(decoded.id, decoded.username);

    // Get enforcement mode
    const enforcementMode = process.env.ATTENDANCE_ENFORCEMENT_MODE || "permissive";
    const fallbackMode = process.env.ATTENDANCE_API_FALLBACK_MODE || "permissive";

    return NextResponse.json({
      isClockedIn: status.isClockedIn,
      clockInTime: status.clockInTime,
      lastChecked: status.lastChecked,
      source: status.source,
      enforcementMode,
      fallbackMode,
      message: status.isClockedIn
        ? "You are clocked in"
        : "You are not clocked in. Please clock in at the attendance app.",
      warning: !status.isClockedIn && enforcementMode !== "permissive"
        ? "Access may be restricted if you don't clock in soon"
        : null,
      attendanceAppUrl: process.env.ATTENDANCE_API_URL || "http://localhost:4000",
    });
  } catch (error) {
    console.error("Error checking attendance status:", error);
    return NextResponse.json(
      { 
        message: "Failed to check attendance status",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

