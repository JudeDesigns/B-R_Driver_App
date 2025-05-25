"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { debounce, throttle, isMobileDevice } from '@/lib/performance';
import { recordPageLoad, recordRenderTime } from '@/lib/performanceMonitor';

/**
 * Hook for monitoring and optimizing component performance
 * @param componentName The name of the component for tracking
 * @returns Performance optimization utilities
 */
export function usePerformance(componentName: string) {
  const renderCount = useRef(0);
  const mountTime = useRef(Date.now());
  const lastRenderTime = useRef(performance.now());
  const isMobile = useRef(isMobileDevice());
  const [isOptimized, setIsOptimized] = useState(false);

  // Record initial page load time
  useEffect(() => {
    // Record the page load time
    recordPageLoad(componentName, mountTime.current);

    // Set up performance optimization based on device type
    if (isMobile.current) {
      // Apply more aggressive optimizations for mobile devices
      setIsOptimized(true);
    }

    return () => {
      // Record the total render time when component unmounts
      const totalTime = performance.now() - mountTime.current;
      recordRenderTime(`${componentName} (total)`, totalTime);
    };
  }, [componentName]);

  // Track render count
  useEffect(() => {
    renderCount.current += 1;
    
    // Calculate time since last render
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    // Record render time
    if (renderCount.current > 1) { // Skip first render
      recordRenderTime(`${componentName} (render ${renderCount.current})`, timeSinceLastRender);
    }
    
    // Log render count in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${componentName} render #${renderCount.current}`);
    }
  });

  /**
   * Create a debounced version of a function
   * @param func The function to debounce
   * @param wait The time to wait in milliseconds
   * @returns A debounced version of the function
   */
  const createDebouncedFunction = useCallback(
    <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
      return debounce(func, wait);
    },
    []
  );

  /**
   * Create a throttled version of a function
   * @param func The function to throttle
   * @param limit The time limit in milliseconds
   * @returns A throttled version of the function
   */
  const createThrottledFunction = useCallback(
    <T extends (...args: any[]) => any>(func: T, limit: number): ((...args: Parameters<T>) => void) => {
      return throttle(func, limit);
    },
    []
  );

  /**
   * Optimize a list for rendering
   * @param list The list to optimize
   * @param pageSize The number of items to show per page
   * @returns The optimized list and pagination controls
   */
  const optimizeList = useCallback(
    <T>(list: T[], pageSize: number = isMobile.current ? 10 : 20) => {
      const [page, setPage] = useState(1);
      const totalPages = Math.ceil(list.length / pageSize);
      
      const paginatedList = list.slice((page - 1) * pageSize, page * pageSize);
      
      const goToPage = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
          setPage(newPage);
        }
      };
      
      return {
        items: paginatedList,
        pagination: {
          page,
          totalPages,
          goToPage,
          nextPage: () => goToPage(page + 1),
          prevPage: () => goToPage(page - 1),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    },
    [isMobile]
  );

  return {
    renderCount: renderCount.current,
    isMobile: isMobile.current,
    isOptimized,
    setIsOptimized,
    createDebouncedFunction,
    createThrottledFunction,
    optimizeList,
  };
}
