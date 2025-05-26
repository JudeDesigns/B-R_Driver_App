import { NextRequest, NextResponse } from "next/server";
import { addSecurityHeaders, SecurityLogger } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    // Get user info from middleware headers if available
    const userId = request.headers.get("x-user-id");
    const userRole = request.headers.get("x-user-role");

    // Log logout event
    if (userId) {
      SecurityLogger.logSecurityEvent("USER_LOGOUT", { userId, userRole }, request);
    }

    // Create response
    const response = NextResponse.json({
      message: "Logged out successfully"
    });

    // Clear the auth cookie
    response.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0, // Expire immediately
      path: "/"
    });

    return addSecurityHeaders(response);
  } catch (error) {
    SecurityLogger.logSuspiciousActivity("LOGOUT_ERROR", {
      error: (error as Error).message
    }, request);
    
    return addSecurityHeaders(NextResponse.json(
      { message: "An error occurred during logout" },
      { status: 500 }
    ));
  }
}
