/**
 * Security Configuration
 * Centralized security settings for the application
 */

export const SecurityConfig = {
  // Authentication settings
  auth: {
    tokenExpiration: "24h",
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    passwordMinLength: 8,
    passwordMaxLength: 128,
    requireSpecialChars: true,
    requireNumbers: true,
    requireUppercase: true,
    requireLowercase: true,
  },

  // Rate limiting settings
  rateLimit: {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    },
    api: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
    driver: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 200, // Higher for real-time updates
    },
  },

  // File upload settings
  fileUpload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ],
    maxFiles: 1,
  },

  // Session settings
  session: {
    cookieName: "auth-token",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 24 * 60 * 60, // 24 hours
  },

  // CSRF settings
  csrf: {
    tokenLength: 32,
    tokenExpiration: 60 * 60 * 1000, // 1 hour
  },

  // Security headers
  headers: {
    contentSecurityPolicy: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
    
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
    
    permissions: "camera=(), microphone=(), geolocation=()",
  },

  // Input validation settings
  validation: {
    maxStringLength: 255,
    maxTextLength: 1000,
    maxRouteNumber: 20,
    maxAmount: 999999.99,
    emailMaxLength: 254,
    usernameMinLength: 3,
    usernameMaxLength: 50,
  },

  // Logging settings
  logging: {
    logSecurityEvents: true,
    logFailedLogins: true,
    logUnauthorizedAccess: true,
    logSuspiciousActivity: true,
    maxLogEntries: 10000, // Rotate after this many entries
  },

  // Environment-specific settings
  development: {
    allowExpiredTokens: false, // Changed to false for security
    verboseLogging: true,
    skipRateLimit: false,
  },

  production: {
    allowExpiredTokens: false,
    verboseLogging: false,
    skipRateLimit: false,
    requireHttps: true,
  },
};

/**
 * Get security config based on environment
 */
export function getSecurityConfig() {
  const baseConfig = SecurityConfig;
  
  if (process.env.NODE_ENV === "production") {
    return {
      ...baseConfig,
      ...baseConfig.production,
    };
  }
  
  return {
    ...baseConfig,
    ...baseConfig.development,
  };
}

/**
 * Validate environment variables for security
 */
export function validateSecurityEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check JWT secret
  if (!process.env.JWT_SECRET) {
    errors.push("JWT_SECRET environment variable is required");
  } else if (process.env.JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters long");
  }
  
  // Check database URL
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL environment variable is required");
  }
  
  // Production-specific checks
  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL.includes("ssl=true") && 
        !process.env.DATABASE_URL.includes("sslmode=require")) {
      errors.push("Production database should use SSL");
    }
    
    if (process.env.DATABASE_URL.includes("localhost")) {
      errors.push("Production should not use localhost database");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
