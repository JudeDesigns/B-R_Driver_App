import { prisma } from "./db";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";

// Mock credentials for fallback
export const mockCredentials = {
  admin: { username: "admin", password: "admin123", role: "ADMIN" },
  superadmin: {
    username: "superadmin",
    password: "superadmin123",
    role: "SUPER_ADMIN",
  },
  driver: { username: "driver", password: "driver123", role: "DRIVER" },
};

// Environment flag to determine if we should use the database
// This can be set in .env file
export const USE_DATABASE = process.env.USE_DATABASE === "true";

// Function to authenticate a user
export async function authenticateUser(username: string, password: string) {
  // First try database authentication if enabled
  if (USE_DATABASE) {
    try {
      // Find user by username
      const user = await prisma.user.findUnique({
        where: { username },
      });

      // If user exists and password matches
      if (user && (await argon2.verify(user.password, password))) {
        return {
          isAuthenticated: true,
          userRole: user.role,
          userId: user.id,
          username: user.username,
        };
      }
    } catch (error) {
      console.error("Database authentication error:", error);
      // Fall back to mock authentication if database fails
    }
  }

  // Fall back to mock authentication
  // Check admin credentials
  if (
    username === mockCredentials.admin.username &&
    password === mockCredentials.admin.password
  ) {
    return {
      isAuthenticated: true,
      userRole: "ADMIN",
      userId: "mock-admin-id",
      username,
    };
  }
  // Check super admin credentials
  else if (
    username === mockCredentials.superadmin.username &&
    password === mockCredentials.superadmin.password
  ) {
    return {
      isAuthenticated: true,
      userRole: "SUPER_ADMIN",
      userId: "mock-superadmin-id",
      username,
    };
  }
  // Check driver credentials
  else if (
    username === mockCredentials.driver.username &&
    password === mockCredentials.driver.password
  ) {
    return {
      isAuthenticated: true,
      userRole: "DRIVER",
      userId: "mock-driver-id",
      username,
    };
  }

  // Authentication failed
  return {
    isAuthenticated: false,
    userRole: "",
    userId: "",
    username: "",
  };
}

// Function to generate a JWT token
export function generateToken(payload: Record<string, unknown>) {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  return jwt.sign(payload, secret, { expiresIn: "8h" });
}

// Function to verify a JWT token
export function verifyToken(token: string) {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}
