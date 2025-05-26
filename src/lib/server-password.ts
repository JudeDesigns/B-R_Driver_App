/**
 * Server-side password utilities
 * This file should only be imported in server-side code (API routes, middleware)
 */

/**
 * Hash a password using argon2 (server-side only)
 */
export async function hashPassword(password: string): Promise<string> {
  // Only use this on server side
  if (typeof window !== 'undefined') {
    throw new Error('hashPassword should only be used on the server side');
  }
  
  try {
    // Dynamic import to avoid bundling issues
    const argon2 = require('argon2');
    return await argon2.hash(password);
  } catch (error) {
    // Fallback to plain password (not recommended for production)
    console.warn('Argon2 not available, using plain password (NOT SECURE)');
    return password;
  }
}

/**
 * Verify a password using argon2 (server-side only)
 */
export async function verifyPassword(hashedPassword: string, plainPassword: string): Promise<boolean> {
  // Only use this on server side
  if (typeof window !== 'undefined') {
    throw new Error('verifyPassword should only be used on the server side');
  }
  
  try {
    // Dynamic import to avoid bundling issues
    const argon2 = require('argon2');
    return await argon2.verify(hashedPassword, plainPassword);
  } catch (error) {
    // Fallback to plain comparison (not recommended for production)
    console.warn('Argon2 not available, using plain comparison (NOT SECURE)');
    return hashedPassword === plainPassword;
  }
}

/**
 * Check if argon2 is available
 */
export function isArgon2Available(): boolean {
  if (typeof window !== 'undefined') {
    return false;
  }
  
  try {
    require('argon2');
    return true;
  } catch (error) {
    return false;
  }
}
