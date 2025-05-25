import * as argon2 from "argon2";
import jwt from "jsonwebtoken";

// Import prisma client
import prisma from "./db";

// Function to authenticate a user
export async function authenticateUser(username: string, password: string) {
  try {
    // Validate inputs
    if (!username || !password) {
      console.error("Missing username or password");
      return {
        isAuthenticated: false,
        userRole: "",
        userId: "",
        username: "",
      };
    }

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    // If user doesn't exist
    if (!user) {
      console.log(`User not found: ${username}`);
      return {
        isAuthenticated: false,
        userRole: "",
        userId: "",
        username: "",
      };
    }

    // Verify password
    try {
      const passwordMatches = await argon2.verify(user.password, password);

      if (passwordMatches) {
        console.log(`User authenticated successfully: ${username}`);
        // Convert SUPER_ADMIN to ADMIN as we're removing the SUPER_ADMIN role
        const userRole = user.role === "SUPER_ADMIN" ? "ADMIN" : user.role;
        return {
          isAuthenticated: true,
          userRole: userRole,
          userId: user.id,
          username: user.username,
        };
      } else {
        console.log(`Password verification failed for user: ${username}`);
        return {
          isAuthenticated: false,
          userRole: "",
          userId: "",
          username: "",
        };
      }
    } catch (verifyError) {
      console.error(
        `Password verification error for user ${username}:`,
        verifyError
      );
      return {
        isAuthenticated: false,
        userRole: "",
        userId: "",
        username: "",
      };
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      isAuthenticated: false,
      userRole: "",
      userId: "",
      username: "",
    };
  }
}

// Function to generate a JWT token
export function generateToken(payload: Record<string, unknown>) {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  // Extend token expiration to 7 days for better user experience
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

// Function to verify a JWT token
export function verifyToken(token: string) {
  if (!token || typeof token !== "string") {
    console.error("Invalid token format:", token);
    return null;
  }

  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  try {
    const decoded = jwt.verify(token, secret) as any;
    // Convert SUPER_ADMIN to ADMIN as we're removing the SUPER_ADMIN role
    if (decoded && decoded.role === "SUPER_ADMIN") {
      decoded.role = "ADMIN";
    }
    return decoded;
  } catch (error) {
    // Check if the error is due to an expired token
    if (error instanceof jwt.TokenExpiredError) {
      console.warn("Token expired:", error.expiredAt);

      // For development purposes, we can try to decode the token anyway
      // This helps prevent disruptions during development
      if (process.env.NODE_ENV === "development") {
        try {
          // Decode without verification to get the payload
          const decoded = jwt.decode(token) as any;
          // Convert SUPER_ADMIN to ADMIN as we're removing the SUPER_ADMIN role
          if (decoded && decoded.role === "SUPER_ADMIN") {
            decoded.role = "ADMIN";
          }
          console.log("Using expired token in development mode:", decoded);
          return decoded;
        } catch (decodeError) {
          console.error("Failed to decode expired token:", decodeError);
        }
      }
    } else {
      console.error("Token verification error:", error);
    }
    return null;
  }
}
