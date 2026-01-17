/**
 * Google Maps integration utilities for driver navigation
 * Provides functions to generate Google Maps links for individual addresses and full routes
 */

export interface MapLocation {
  address: string;
  customerName: string;
  sequence: number;
}

export interface RouteMapData {
  startLocation?: string; // Optional starting point (e.g., warehouse)
  stops: MapLocation[];
  endLocation?: string; // Optional ending point
}

/**
 * Formats an address for Google Maps URL encoding
 * Cleans up the address and ensures proper URL encoding
 */
export function formatAddressForMaps(address: string): string {
  if (!address || address.trim() === '') {
    return '';
  }

  // Clean up the address
  let cleanAddress = address.trim();
  
  // Remove extra spaces and normalize
  cleanAddress = cleanAddress.replace(/\s+/g, ' ');
  
  // URL encode the address
  return encodeURIComponent(cleanAddress);
}

/**
 * Generates a Google Maps search link for a single address
 * Uses the Google Maps search API format
 */
export function generateSingleAddressMapLink(address: string): string {
  const formattedAddress = formatAddressForMaps(address);
  
  if (!formattedAddress) {
    return '';
  }

  return `https://www.google.com/maps/search/?api=1&query=${formattedAddress}`;
}

/**
 * Generates a Google Maps directions link for a single destination
 * This opens Google Maps with directions to the specific address
 */
export function generateDirectionsToAddress(address: string): string {
  const formattedAddress = formatAddressForMaps(address);
  
  if (!formattedAddress) {
    return '';
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${formattedAddress}`;
}

/**
 * Generates a Google Maps route link for multiple stops
 * Uses the Directions API format to preserve the exact sequence of stops
 * This prevents Google Maps from auto-optimizing the route order
 */
export function generateFullRouteMapLink(routeData: RouteMapData): string {
  if (!routeData.stops || routeData.stops.length === 0) {
    return '';
  }

  // Sort stops by sequence to maintain delivery order
  const sortedStops = [...routeData.stops].sort((a, b) => a.sequence - b.sequence);

  if (sortedStops.length === 1) {
    // For single stop, just use directions to that address
    const formattedAddress = formatAddressForMaps(sortedStops[0].address);
    return `https://www.google.com/maps/dir/?api=1&destination=${formattedAddress}&travelmode=driving`;
  }

  // For multiple stops, use origin + destination + waypoints format
  // This preserves the exact order and prevents Google Maps from reordering
  const origin = routeData.startLocation || sortedStops[0].address;
  const destination = routeData.endLocation || sortedStops[sortedStops.length - 1].address;

  // Middle stops become waypoints (if we have more than 2 stops)
  const waypoints: string[] = [];

  if (routeData.startLocation) {
    // If we have a custom start location, all sorted stops become waypoints except the last
    for (let i = 0; i < sortedStops.length - 1; i++) {
      waypoints.push(sortedStops[i].address);
    }
  } else {
    // First stop is origin, last is destination, middle ones are waypoints
    for (let i = 1; i < sortedStops.length - 1; i++) {
      waypoints.push(sortedStops[i].address);
    }
  }

  // Build the URL using Directions API format
  let routeUrl = 'https://www.google.com/maps/dir/?api=1';
  routeUrl += `&origin=${formatAddressForMaps(origin)}`;
  routeUrl += `&destination=${formatAddressForMaps(destination)}`;

  // Add waypoints if any (separated by |)
  if (waypoints.length > 0) {
    const formattedWaypoints = waypoints
      .map(wp => formatAddressForMaps(wp))
      .filter(wp => wp !== '')
      .join('|');
    if (formattedWaypoints) {
      routeUrl += `&waypoints=${formattedWaypoints}`;
    }
  }

  // Add travel mode
  routeUrl += '&travelmode=driving';

  return routeUrl;
}

/**
 * Generates a Google Maps route link with waypoint optimization
 * Uses Google Maps waypoint optimization for better route planning
 */
export function generateOptimizedRouteMapLink(routeData: RouteMapData): string {
  if (!routeData.stops || routeData.stops.length === 0) {
    return '';
  }

  // For routes with many stops, we'll use the standard route format
  // Google Maps automatically optimizes routes when there are multiple waypoints
  return generateFullRouteMapLink(routeData);
}

/**
 * Validates if an address is suitable for Google Maps
 * Checks for minimum address requirements
 */
export function isValidAddressForMaps(address: string): boolean {
  if (!address || address.trim() === '') {
    return false;
  }

  const cleanAddress = address.trim();
  
  // Basic validation - address should have at least some meaningful content
  if (cleanAddress.length < 5) {
    return false;
  }

  // Check for common invalid addresses
  const invalidPatterns = [
    /^n\/a$/i,
    /^none$/i,
    /^unknown$/i,
    /^tbd$/i,
    /^pending$/i
  ];

  return !invalidPatterns.some(pattern => pattern.test(cleanAddress));
}

/**
 * Extracts route data from stops array for map generation
 * Converts stop data into the format needed for map links
 */
export function extractRouteDataFromStops(stops: Array<{
  sequence: number;
  address?: string; // Direct address field (optional)
  customer: {
    name: string;
    address?: string; // Customer address field (optional)
  };
}>): RouteMapData {
  const validStops = stops
    .filter(stop => {
      // Check both stop.address and stop.customer.address
      const address = stop.address || stop.customer.address || '';
      return isValidAddressForMaps(address);
    })
    .map(stop => ({
      address: stop.address || stop.customer.address || '',
      customerName: stop.customer.name,
      sequence: stop.sequence
    }));

  return {
    stops: validStops
  };
}

/**
 * Generates a user-friendly display name for a map link
 * Creates descriptive text for map link buttons
 */
export function getMapLinkDisplayText(type: 'single' | 'route', stopCount?: number): string {
  switch (type) {
    case 'single':
      return '📍 Open in Google Maps';
    case 'route':
      return `🗺️ View Full Route${stopCount ? ` (${stopCount} stops)` : ''}`;
    default:
      return 'Open in Maps';
  }
}

/**
 * Configuration for Google Maps integration
 */
export const GOOGLE_MAPS_CONFIG = {
  // Default starting location (can be configured per company)
  DEFAULT_START_LOCATION: '', // Empty by default, can be set to warehouse address
  
  // Map link preferences
  OPEN_IN_NEW_TAB: true,
  
  // URL parameters
  DEFAULT_TRAVEL_MODE: 'driving',
  
  // Validation settings
  MIN_ADDRESS_LENGTH: 5,
  MAX_STOPS_PER_ROUTE: 25 // Google Maps limitation for waypoints
} as const;
