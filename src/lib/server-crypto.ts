/**
 * Server-side crypto utilities
 * This file should only be imported in server-side code (API routes, middleware)
 */

/**
 * Generate a cryptographically secure random token
 * Only use this in server-side code
 */
export function generateSecureToken(length: number = 32): string {
  // Only import crypto in server environment
  if (typeof window !== 'undefined') {
    throw new Error('generateSecureToken should only be used on the server side');
  }
  
  try {
    // Dynamic import to avoid bundling issues
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  } catch (error) {
    // Fallback to less secure but functional random string
    console.warn('Crypto module not available, using fallback random generator');
    return generateFallbackToken(length * 2); // *2 because hex encoding
  }
}

/**
 * Fallback random token generator
 */
function generateFallbackToken(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  return generateSecureToken(16); // 32 character hex string
}

/**
 * Generate a secure API key
 */
export function generateApiKey(): string {
  return generateSecureToken(32); // 64 character hex string
}

/**
 * Hash a string using a simple hash function (server-side only)
 */
export function simpleHash(input: string): string {
  if (typeof window !== 'undefined') {
    throw new Error('simpleHash should only be used on the server side');
  }
  
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(input).digest('hex');
  } catch (error) {
    // Fallback hash function
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
