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
      return {
        isAuthenticated: false,
        userRole: "",
        userId: "",
        username: "",
      };
    }

    // Check if user is deleted
    if (user.isDeleted) {
      return {
        isAuthenticated: false,
        userRole: "",
        userId: "",
        username: "",
      };
    }

    // Verify password
    try {
      let passwordMatches = false;

      // Check if password is hashed (starts with $argon2)
      if (user.password.startsWith("$argon2")) {
        // Use argon2 verification for hashed passwords
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

      if (passwordMatches) {
        // Convert SUPER_ADMIN to ADMIN as we're removing the SUPER_ADMIN role
        const userRole = user.role === "SUPER_ADMIN" ? "ADMIN" : user.role;
        return {
          isAuthenticated: true,
          userRole: userRole,
          userId: user.id,
          username: user.username,
        };
      } else {
        // Don't log specific failure details for security
        return {
          isAuthenticated: false,
          userRole: "",
          userId: "",
          username: "",
        };
      }
    } catch (verifyError) {
      // Log error without exposing username for security
      console.error("Password verification error:", verifyError);
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
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  // Reduced token expiration to 24 hours for better security
  return jwt.sign(payload, secret, {
    expiresIn: "24h",
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

// Function to verify a JWT token
export function verifyToken(token: string) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: "br-food-services",
      audience: "br-food-services-users",
    }) as any;

    // Convert SUPER_ADMIN to ADMIN as we're removing the SUPER_ADMIN role
    if (decoded && decoded.role === "SUPER_ADMIN") {
      decoded.role = "ADMIN";
    }

    // Validate required fields
    if (!decoded.id || !decoded.role || !decoded.username) {
      return null;
    }

    return decoded;
  } catch (error) {
    // Log security events for monitoring
    if (error instanceof jwt.TokenExpiredError) {
      console.warn("Security Event: Expired token attempt");
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn("Security Event: Invalid token attempt");
    } else {
      console.error("Token verification error:", error);
    }
    return null;
  }
}
