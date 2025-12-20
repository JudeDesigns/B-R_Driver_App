import { NextRequest, NextResponse } from "next/server";
import prisma from "./db";
import { verifyToken } from "./auth";

/**
 * Password confirmation result
 */
export interface PasswordConfirmationResult {
  confirmed: boolean;
  userId?: string;
  userRole?: string;
  error?: string;
  status?: number;
}

/**
 * Verify password confirmation for sensitive operations
 * 
 * This function checks if the user provided their password in the request body
 * and verifies it against their stored password.
 * 
 * @param request - The NextRequest object
 * @returns PasswordConfirmationResult
 */
export async function verifyPasswordConfirmation(
  request: NextRequest
): Promise<PasswordConfirmationResult> {
  try {
    // 1. Verify JWT authentication first
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        confirmed: false,
        error: "Unauthorized: No token provided",
        status: 401,
      };
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return {
        confirmed: false,
        error: "Unauthorized: Invalid token",
        status: 401,
      };
    }

    // 2. Check if password confirmation is required (feature flag)
    const passwordConfirmationEnabled =
      process.env.PASSWORD_CONFIRMATION_ENABLED === "true";

    if (!passwordConfirmationEnabled) {
      // Feature disabled - allow operation without password
      return {
        confirmed: true,
        userId: decoded.id,
        userRole: decoded.role,
      };
    }

    // 3. Get password from request body
    // Clone the request to avoid consuming the body
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();
    const { password } = body;

    if (!password) {
      return {
        confirmed: false,
        error: "Password confirmation required for this operation",
        status: 403,
      };
    }

    // 4. Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        isDeleted: true,
      },
    });

    if (!user || user.isDeleted) {
      return {
        confirmed: false,
        error: "User not found",
        status: 404,
      };
    }

    // 5. Verify password
    let passwordMatches = false;

    // Check if password is hashed (starts with $argon2)
    if (user.password.startsWith("$argon2")) {
      try {
        const argon2 = require("argon2");
        passwordMatches = await argon2.verify(user.password, password);
      } catch (argon2Error) {
        console.error("Argon2 verification error:", argon2Error);
        // Fallback: if argon2 fails, try simple comparison
        passwordMatches = user.password === password;
      }
    } else {
      // Simple comparison for plain text passwords
      passwordMatches = user.password === password;
    }

    if (!passwordMatches) {
      return {
        confirmed: false,
        error: "Incorrect password",
        status: 403,
      };
    }

    // 6. Password confirmed successfully
    return {
      confirmed: true,
      userId: user.id,
      userRole: user.role,
    };
  } catch (error) {
    console.error("Password confirmation error:", error);
    return {
      confirmed: false,
      error: "Failed to verify password",
      status: 500,
    };
  }
}

/**
 * Helper function to create a standardized error response
 * for password confirmation failures
 */
export function createPasswordConfirmationErrorResponse(
  result: PasswordConfirmationResult
): NextResponse {
  return NextResponse.json(
    { message: result.error || "Password confirmation failed" },
    { status: result.status || 403 }
  );
}

