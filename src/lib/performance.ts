/**
 * Performance optimization utilities
 */

/**
 * Debounce function to limit the rate at which a function can fire
 * @param func The function to debounce
 * @param wait The time to wait in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit the rate at which a function can fire
 * @param func The function to throttle
 * @param limit The time limit in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      lastRan = Date.now();
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Memoize function to cache results of expensive function calls
 * @param func The function to memoize
 * @returns A memoized version of the function
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => ReturnType<T> {
  const cache = new Map<string, ReturnType<T>>();

  return function (...args: Parameters<T>): ReturnType<T> {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<T>;
    }
    const result = func(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Batch updates to the DOM to reduce reflows and repaints
 * @param callback The function to execute in the next animation frame
 */
export function batchUpdate(callback: () => void): void {
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      callback();
    });
  } else {
    callback();
  }
}

/**
 * Detect if the device is a mobile device
 * @returns True if the device is a mobile device, false otherwise
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detect if the device has a slow connection
 * @returns True if the device has a slow connection, false otherwise
 */
export function hasSlowConnection(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) return false;
  
  // @ts-ignore - navigator.connection is not in the TypeScript types
  const connection = navigator.connection;
  
  if (!connection) return false;
  
  // Check if the connection is slow
  if ('effectiveType' in connection) {
    // @ts-ignore - effectiveType is not in the TypeScript types
    return ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
  }
  
  return false;
}

/**
 * Lazy load an image
 * @param src The source of the image
 * @param placeholder The placeholder to show while the image is loading
 * @param onLoad Callback function to execute when the image is loaded
 * @returns An object with the current source and loading state
 */
export function useLazyImage(
  src: string,
  placeholder: string = '',
  onLoad?: () => void
): { currentSrc: string; isLoading: boolean } {
  if (typeof window === 'undefined') {
    return { currentSrc: placeholder, isLoading: true };
  }

  const image = new Image();
  let currentSrc = placeholder;
  let isLoading = true;

  image.onload = () => {
    currentSrc = src;
    isLoading = false;
    if (onLoad) onLoad();
  };

  image.src = src;

  return { currentSrc, isLoading };
}

/**
 * Optimize socket event handling to prevent unnecessary re-renders
 * @param handler The event handler function
 * @param dependencies Dependencies that should trigger a new handler
 * @returns A memoized event handler
 */
export function optimizeSocketHandler<T>(
  handler: (data: T) => void,
  dependencies: any[] = []
): (data: T) => void {
  // Create a reference to store the previous data
  let prevData: T | null = null;

  // Return a memoized handler that only calls the original handler if the data has changed
  return (data: T) => {
    // Skip if the data is the same as the previous data
    if (prevData && JSON.stringify(prevData) === JSON.stringify(data)) {
      return;
    }

    // Update the previous data reference
    prevData = data;

    // Call the original handler
    handler(data);
  };
}
