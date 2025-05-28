/**
 * Environment variable validation and configuration
 * Ensures all required environment variables are present and valid
 */

interface EnvironmentConfig {
  NODE_ENV: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT: number;
  NEXTAUTH_URL?: string;
  NEXTAUTH_SECRET?: string;
}

/**
 * Validates and returns environment configuration
 * Throws an error if required variables are missing
 */
export function validateEnvironment(): EnvironmentConfig {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  // Validate JWT_SECRET strength in production
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error(
        'JWT_SECRET must be at least 32 characters long in production'
      );
    }
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    PORT: parseInt(process.env.PORT || '3000', 10),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  };
}

/**
 * Get validated environment configuration
 * Cached after first call for performance
 */
let cachedConfig: EnvironmentConfig | null = null;

export function getEnvironmentConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnvironment();
  }
  return cachedConfig;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get database URL with validation
 */
export function getDatabaseUrl(): string {
  const config = getEnvironmentConfig();
  return config.DATABASE_URL;
}

/**
 * Get JWT secret with validation
 */
export function getJwtSecret(): string {
  const config = getEnvironmentConfig();
  return config.JWT_SECRET;
}
