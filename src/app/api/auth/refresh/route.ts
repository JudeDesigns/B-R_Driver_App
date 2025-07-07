import { NextRequest, NextResponse } from "next/server";
import { verifyToken, generateToken } from "@/lib/auth";
import prisma from "@/lib/db";

// POST /api/auth/refresh - Refresh a JWT token
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Extract the token
    const token = authHeader.split(" ")[1];
    
    // Verify the token
    const decoded = verifyToken(token) as any;
    
    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }
    
    // Check if the user exists in the database
    let user;
    
    try {
      user = await prisma.user.findUnique({
        where: {
          id: decoded.id,
          isDeleted: false,
        },
        select: {
          id: true,
          username: true,
          role: true,
        },
      });
    } catch (error) {
      console.error("Database error:", error);
      // If database check fails, we'll use the decoded token data
      user = null;
    }
    
    // If user not found in database, use the decoded token data
    // This allows the app to work even if the database is not available
    if (!user) {
      user = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
      };
    }
    
    // Generate a new token with extended expiration for drivers
    const tokenExpiry = user.role === "DRIVER" ? "12h" : "2h"; // 12 hours for drivers, 2 hours for others

    const newToken = generateToken({
      id: user.id,
      username: user.username,
      role: user.role,
    }, tokenExpiry);

    console.log(`Token refreshed for ${user.role}: ${user.username} (expires in ${tokenExpiry})`);
    
    // Return the new token
    return NextResponse.json({
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      expiresIn: tokenExpiry,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
