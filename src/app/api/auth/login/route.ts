import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, generateToken } from "@/lib/auth";

// Import session manager with error handling
let sessionManager: any = null;
try {
  const sessionModule = require("@/lib/sessionManager");
  sessionManager = sessionModule.sessionManager;
} catch (error) {
  console.warn("Session manager not available in login API");
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    let username, password;
    try {
      const body = await request.json();
      username = body.username;
      password = body.password;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { message: "Invalid request format" },
        { status: 400 }
      );
    }

    // Validate input
    if (!username || !password) {
      if (process.env.NODE_ENV !== "production") {
        console.log("Missing credentials:", {
          username: !!username,
          password: !!password,
        });
      }
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 }
      );
    }

    // Authenticate user
    const {
      isAuthenticated,
      userRole,
      userId,
      username: userName,
    } = await authenticateUser(username, password);

    if (!isAuthenticated) {
      return NextResponse.json(
        { message: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Clear any session invalidations for this user (they're logging in with new credentials)
    try {
      sessionManager.clearUserInvalidation(userId);
    } catch (error) {
      console.warn("Failed to clear user session invalidation:", error.message);
    }

    // Generate JWT token with extended expiration for drivers
    const tokenExpiry = userRole === "DRIVER" ? "12h" : "2h"; // 12 hours for drivers, 2 hours for others
    const token = generateToken({
      id: userId,
      username: userName,
      role: userRole,
    }, tokenExpiry);

    console.log(`Login successful for ${userRole}: ${userName} (token expires in ${tokenExpiry})`);

    // Return user info and token
    return NextResponse.json({
      user: {
        id: userId,
        username: userName,
        role: userRole,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "An error occurred during login" },
      { status: 500 }
    );
  }
}
