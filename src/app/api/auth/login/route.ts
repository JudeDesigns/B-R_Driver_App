import { NextResponse } from "next/server";
import { authenticateUser, generateToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Parse the request body
    let username, password;
    try {
      const body = await request.json();
      username = body.username;
      password = body.password;
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { message: "Invalid request format" },
        { status: 400 }
      );
    }

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { message: "Username and password are required" },
        { status: 400 }
      );
    }

    // Authenticate user (will try database first, then fall back to mock data)
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

    // Generate JWT token
    const token = generateToken({
      id: userId,
      username: userName,
      role: userRole,
    });

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
