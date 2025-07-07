import jwt from "jsonwebtoken";

// Import prisma client
import prisma from "./db";
import { getJwtSecret } from "./env";

// Import session manager with error handling
let sessionManager: any = null;
try {
  const sessionModule = require("./sessionManager");
  sessionManager = sessionModule.sessionManager;
} catch (error) {
  console.warn("Session manager not available, session invalidation disabled");
}

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
        return {
          isAuthenticated: true,
          userRole: user.role, // Keep original role (SUPER_ADMIN, ADMIN, DRIVER)
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
export function generateToken(payload: Record<string, unknown>, expiresIn: string = "24h") {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: "br-food-services",
    audience: "br-food-services-users",
  });
}

// Function to verify a JWT token
export function verifyToken(token: string, options: { ignoreExpiration?: boolean } = {}) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const secret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: "br-food-services",
      audience: "br-food-services-users",
      ignoreExpiration: options.ignoreExpiration || false,
    }) as any;

    // Keep original roles (SUPER_ADMIN, ADMIN, DRIVER) for proper role separation

    // Validate required fields
    if (!decoded.id || !decoded.role || !decoded.username) {
      return null;
    }

    // Check if user sessions have been invalidated (e.g., password changed)
    try {
      if (sessionManager && sessionManager.areUserSessionsInvalidated(decoded.id)) {
        console.warn(`Security Event: Invalidated session attempt for user ${decoded.id}`);
        return null;
      }
    } catch (sessionError) {
      // If session management fails, log but don't block login
      console.warn("Session management check failed, allowing login:", sessionError.message);
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
