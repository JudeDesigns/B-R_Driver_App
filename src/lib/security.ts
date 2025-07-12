import { NextRequest, NextResponse } from "next/server";
import { generateSecureToken } from "./server-crypto";

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configurations for different endpoints
const rateLimitConfigs: Record<string, RateLimitConfig> = {
  "/api/auth/login": {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: "Too many login attempts, please try again later",
  },
  "/api/admin": {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: "Too many requests, please slow down",
  },
  "/api/driver": {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute (drivers need more for real-time updates)
    message: "Too many requests, please slow down",
  },
  default: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: "Too many requests, please slow down",
  },
};

/**
 * Rate limiting middleware
 */
export function rateLimit(request: NextRequest): NextResponse | null {
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const path = request.nextUrl.pathname;

  // Find matching rate limit config
  let config = rateLimitConfigs.default;
  for (const [pattern, patternConfig] of Object.entries(rateLimitConfigs)) {
    if (pattern !== "default" && path.startsWith(pattern)) {
      config = patternConfig;
      break;
    }
  }

  const key = `${ip}:${path}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Clean up old entries
  for (const [storeKey, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(storeKey);
    }
  }

  // Get current count for this IP/path combination
  const current = rateLimitStore.get(key);

  if (!current || current.resetTime < now) {
    // First request in window or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null; // Allow request
  }

  if (current.count >= config.maxRequests) {
    // Rate limit exceeded
    return NextResponse.json(
      {
        message: config.message,
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((current.resetTime - now) / 1000).toString(),
          "X-RateLimit-Limit": config.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": current.resetTime.toString(),
        },
      }
    );
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);

  return null; // Allow request
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline and unsafe-eval
    "style-src 'self' 'unsafe-inline'", // Allow inline styles for styling
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // HSTS (only in production with HTTPS)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

/**
 * Input validation utilities
 */
export class InputValidator {
  static sanitizeString(input: string, maxLength: number = 255): string {
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    // Remove potentially dangerous characters but preserve business-relevant characters
    const sanitized = input
      .replace(/[<>\"]/g, "") // Remove HTML/script injection characters (but keep & and ')
      .replace(/[\x00-\x1f\x7f]/g, "") // Remove control characters
      .trim()
      .substring(0, maxLength);

    return sanitized;
  }

  // New method specifically for customer names that preserves business characters
  static sanitizeCustomerName(input: string, maxLength: number = 255): string {
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    // For customer names, only remove truly dangerous characters
    // Preserve ampersands (&), apostrophes ('), and other business-relevant characters
    const sanitized = input
      .replace(/[<>\"]/g, "") // Remove only HTML/script injection characters
      .replace(/[\x00-\x1f\x7f]/g, "") // Remove control characters
      .trim()
      .substring(0, maxLength);

    return sanitized;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  static validateUsername(username: string): boolean {
    // Username: 3-50 characters, alphanumeric and underscore only
    const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
    return usernameRegex.test(username);
  }

  static validatePassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (password.length > 128) {
      errors.push("Password must be less than 128 characters");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static validateRouteNumber(routeNumber: string): boolean {
    // Route number: 1-20 characters, alphanumeric and dash only
    const routeRegex = /^[a-zA-Z0-9\-]{1,20}$/;
    return routeRegex.test(routeNumber);
  }

  static validateAmount(amount: number): boolean {
    return (
      typeof amount === "number" &&
      !isNaN(amount) &&
      isFinite(amount) &&
      amount >= 0 &&
      amount <= 999999.99
    );
  }
}

/**
 * Security event logging
 */
export class SecurityLogger {
  static logSecurityEvent(
    event: string,
    details: Record<string, any>,
    request?: NextRequest
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      ip: request?.ip || request?.headers.get("x-forwarded-for") || "unknown",
      userAgent: request?.headers.get("user-agent") || "unknown",
      path: request?.nextUrl.pathname || "unknown",
    };

    // In production, log security events for monitoring
    if (process.env.NODE_ENV === "production") {
      console.warn("SECURITY EVENT:", JSON.stringify(logEntry));
      // Note: Consider integrating with external security monitoring service
      // such as Sentry, DataDog, or similar for production deployments
    } else {
      console.warn("Security Event:", logEntry);
    }
  }

  static logFailedLogin(username: string, request: NextRequest) {
    this.logSecurityEvent("FAILED_LOGIN", { username }, request);
  }

  static logSuccessfulLogin(username: string, request: NextRequest) {
    this.logSecurityEvent("SUCCESSFUL_LOGIN", { username }, request);
  }

  static logUnauthorizedAccess(path: string, request: NextRequest) {
    this.logSecurityEvent("UNAUTHORIZED_ACCESS", { path }, request);
  }

  static logSuspiciousActivity(
    activity: string,
    details: Record<string, any>,
    request: NextRequest
  ) {
    this.logSecurityEvent(
      "SUSPICIOUS_ACTIVITY",
      { activity, ...details },
      request
    );
  }
}
