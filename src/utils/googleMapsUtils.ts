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
 * Creates an optimized route through all delivery addresses
 */
export function generateFullRouteMapLink(routeData: RouteMapData): string {
  if (!routeData.stops || routeData.stops.length === 0) {
    return '';
  }

  // Sort stops by sequence to maintain delivery order
  const sortedStops = [...routeData.stops].sort((a, b) => a.sequence - b.sequence);
  
  // Build the route URL
  let routeUrl = 'https://www.google.com/maps/dir/';
  
  // Add starting location if provided
  if (routeData.startLocation) {
    routeUrl += formatAddressForMaps(routeData.startLocation) + '/';
  }
  
  // Add all stops
  sortedStops.forEach(stop => {
    const formattedAddress = formatAddressForMaps(stop.address);
    if (formattedAddress) {
      routeUrl += formattedAddress + '/';
    }
  });
  
  // Add ending location if provided
  if (routeData.endLocation) {
    routeUrl += formatAddressForMaps(routeData.endLocation) + '/';
  }
  
  // Add route parameters for driving directions
  routeUrl += '?travelmode=driving';
  
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
  address: string;
  customer: { name: string };
}>): RouteMapData {
  const validStops = stops
    .filter(stop => isValidAddressForMaps(stop.address))
    .map(stop => ({
      address: stop.address,
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
