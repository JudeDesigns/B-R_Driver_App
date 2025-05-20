/**
 * Simple in-memory cache implementation for API responses
 * This helps reduce database load for frequently accessed data
 */

interface CacheItem<T> {
  data: T;
  expiry: number;
}

class ApiCache {
  private cache: Map<string, CacheItem<any>>;
  private defaultTTL: number; // Time to live in milliseconds

  constructor(defaultTTL = 60000) { // Default 1 minute TTL
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get an item from the cache
   * @param key Cache key
   * @returns The cached data or null if not found or expired
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    // Return null if item doesn't exist
    if (!item) return null;
    
    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  /**
   * Set an item in the cache
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Time to live in milliseconds (optional, uses default if not provided)
   */
  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry });
  }

  /**
   * Delete an item from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear all items with keys that match the given pattern
   * @param pattern Regex pattern to match against keys
   */
  clearPattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get or set cache item with a function that generates the data if not found
   * @param key Cache key
   * @param fn Function to generate data if not in cache
   * @param ttl Time to live in milliseconds (optional)
   * @returns The cached or newly generated data
   */
  async getOrSet<T>(key: string, fn: () => Promise<T>, ttl = this.defaultTTL): Promise<T> {
    // Try to get from cache first
    const cachedData = this.get<T>(key);
    if (cachedData !== null) {
      return cachedData;
    }
    
    // Generate new data
    const data = await fn();
    
    // Cache the result
    this.set(key, data, ttl);
    
    return data;
  }
}

// Create a singleton instance
export const apiCache = new ApiCache();

// Export different TTL constants for different types of data
export const TTL = {
  SHORT: 30000,      // 30 seconds
  MEDIUM: 300000,    // 5 minutes
  LONG: 3600000,     // 1 hour
  VERY_LONG: 86400000 // 24 hours
};

export default apiCache;
