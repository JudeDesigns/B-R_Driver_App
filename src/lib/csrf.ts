import { NextRequest } from "next/server";

// Conditional import for server-side crypto
let generateSecureToken: ((length?: number) => string) | null = null;
try {
  // Only import on server side
  if (typeof window === "undefined") {
    generateSecureToken = require("./server-crypto").generateSecureToken;
  }
} catch (error) {
  // Ignore import errors
}

// CSRF token store (use Redis in production)
const csrfTokenStore = new Map<string, { token: string; expires: number }>();

/**
 * Generate a random token (server-side secure, client-side fallback)
 */
function generateRandomToken(): string {
  // Use secure crypto if available (server-side)
  if (generateSecureToken) {
    return generateSecureToken(32); // 64 character hex string
  }

  // Fallback for client-side or when crypto is not available
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
  const token = generateRandomToken();
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour expiration

  csrfTokenStore.set(sessionId, { token, expires });

  // Clean up expired tokens
  for (const [key, value] of csrfTokenStore.entries()) {
    if (value.expires < Date.now()) {
      csrfTokenStore.delete(key);
    }
  }

  return token;
}

/**
 * Verify a CSRF token
 */
export function verifyCSRFToken(sessionId: string, token: string): boolean {
  const stored = csrfTokenStore.get(sessionId);

  if (!stored) {
    return false;
  }

  if (stored.expires < Date.now()) {
    csrfTokenStore.delete(sessionId);
    return false;
  }

  return stored.token === token;
}

/**
 * CSRF protection middleware
 */
export function csrfProtection(request: NextRequest): boolean {
  // Only protect state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    return true;
  }

  // Skip CSRF for login endpoint (chicken and egg problem)
  if (request.nextUrl.pathname === "/api/auth/login") {
    return true;
  }

  const sessionId = request.headers.get("x-user-id") || "anonymous";
  const csrfToken = request.headers.get("x-csrf-token");

  if (!csrfToken) {
    return false;
  }

  return verifyCSRFToken(sessionId, csrfToken);
}

/**
 * Get CSRF token for a session
 */
export function getCSRFToken(sessionId: string): string | null {
  const stored = csrfTokenStore.get(sessionId);

  if (!stored || stored.expires < Date.now()) {
    return null;
  }

  return stored.token;
}
