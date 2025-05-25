/**
 * Performance monitoring utilities
 */

// Performance metrics storage
interface PerformanceMetrics {
  pageLoads: Record<string, number[]>;
  apiCalls: Record<string, number[]>;
  renderTimes: Record<string, number[]>;
  socketEvents: Record<string, number[]>;
}

// Initialize metrics storage
const metrics: PerformanceMetrics = {
  pageLoads: {},
  apiCalls: {},
  renderTimes: {},
  socketEvents: {},
};

/**
 * Record the time it takes to load a page
 * @param pageName The name of the page
 * @param startTime The start time of the page load
 */
export function recordPageLoad(pageName: string, startTime: number): void {
  const loadTime = performance.now() - startTime;
  
  if (!metrics.pageLoads[pageName]) {
    metrics.pageLoads[pageName] = [];
  }
  
  metrics.pageLoads[pageName].push(loadTime);
  
  // Log the page load time in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Page load time for ${pageName}: ${loadTime.toFixed(2)}ms`);
  }
}

/**
 * Record the time it takes to make an API call
 * @param endpoint The API endpoint
 * @param startTime The start time of the API call
 */
export function recordApiCall(endpoint: string, startTime: number): void {
  const callTime = performance.now() - startTime;
  
  if (!metrics.apiCalls[endpoint]) {
    metrics.apiCalls[endpoint] = [];
  }
  
  metrics.apiCalls[endpoint].push(callTime);
  
  // Log the API call time in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`API call time for ${endpoint}: ${callTime.toFixed(2)}ms`);
  }
}

/**
 * Record the time it takes to render a component
 * @param componentName The name of the component
 * @param renderTime The time it took to render the component
 */
export function recordRenderTime(componentName: string, renderTime: number): void {
  if (!metrics.renderTimes[componentName]) {
    metrics.renderTimes[componentName] = [];
  }
  
  metrics.renderTimes[componentName].push(renderTime);
  
  // Log the render time in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Render time for ${componentName}: ${renderTime.toFixed(2)}ms`);
  }
}

/**
 * Record the time it takes to process a socket event
 * @param eventName The name of the socket event
 * @param startTime The start time of the socket event processing
 */
export function recordSocketEvent(eventName: string, startTime: number): void {
  const eventTime = performance.now() - startTime;
  
  if (!metrics.socketEvents[eventName]) {
    metrics.socketEvents[eventName] = [];
  }
  
  metrics.socketEvents[eventName].push(eventTime);
  
  // Log the socket event time in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Socket event time for ${eventName}: ${eventTime.toFixed(2)}ms`);
  }
}

/**
 * Get the average time for a specific metric
 * @param metricType The type of metric
 * @param name The name of the metric
 * @returns The average time for the metric
 */
export function getAverageTime(
  metricType: keyof PerformanceMetrics,
  name: string
): number {
  const metricValues = metrics[metricType][name];
  
  if (!metricValues || metricValues.length === 0) {
    return 0;
  }
  
  const sum = metricValues.reduce((acc, val) => acc + val, 0);
  return sum / metricValues.length;
}

/**
 * Get all performance metrics
 * @returns All performance metrics
 */
export function getAllMetrics(): PerformanceMetrics {
  return metrics;
}

/**
 * Clear all performance metrics
 */
export function clearMetrics(): void {
  Object.keys(metrics).forEach((key) => {
    metrics[key as keyof PerformanceMetrics] = {};
  });
}

/**
 * Performance monitoring hook for React components
 * @param componentName The name of the component
 * @returns An object with start and end functions
 */
export function usePerformanceMonitor(componentName: string) {
  let startTime = 0;
  
  const start = () => {
    startTime = performance.now();
  };
  
  const end = () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    recordRenderTime(componentName, renderTime);
    return renderTime;
  };
  
  return { start, end };
}

/**
 * Create a performance-wrapped fetch function
 * @returns A fetch function that records performance metrics
 */
export function createPerformanceFetch() {
  return async (url: string, options?: RequestInit) => {
    const startTime = performance.now();
    try {
      const response = await fetch(url, options);
      recordApiCall(url, startTime);
      return response;
    } catch (error) {
      recordApiCall(`${url} (error)`, startTime);
      throw error;
    }
  };
}

// Export a performance-wrapped fetch function
export const performanceFetch = createPerformanceFetch();
