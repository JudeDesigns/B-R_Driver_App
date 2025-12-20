'use client';

import React from 'react';
import { 
  generateSingleAddressMapLink, 
  generateDirectionsToAddress,
  isValidAddressForMaps,
  getMapLinkDisplayText,
  GOOGLE_MAPS_CONFIG 
} from '@/utils/googleMapsUtils';

interface GoogleMapsLinkProps {
  address: string;
  customerName?: string;
  type?: 'search' | 'directions';
  variant?: 'button' | 'link' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export default function GoogleMapsLink({
  address,
  customerName,
  type = 'directions',
  variant = 'button',
  size = 'md',
  className = '',
  children
}: GoogleMapsLinkProps) {
  // Validate address
  if (!isValidAddressForMaps(address)) {
    return null;
  }

  // Generate the appropriate map link
  const mapLink = type === 'search' 
    ? generateSingleAddressMapLink(address)
    : generateDirectionsToAddress(address);

  if (!mapLink) {
    return null;
  }

  // Handle click event
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (GOOGLE_MAPS_CONFIG.OPEN_IN_NEW_TAB) {
      window.open(mapLink, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = mapLink;
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  // Variant-specific rendering
  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors ${sizeClasses[size]} ${className}`}
        title={`Get directions to ${customerName || 'this address'}`}
        aria-label={`Open Google Maps directions to ${customerName || 'this address'}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    );
  }

  if (variant === 'link') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline transition-colors ${className}`}
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {children || getMapLinkDisplayText('single')}
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${sizeClasses[size]} ${className}`}
      title={`Get directions to ${customerName || 'this address'}`}
    >
      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {children || getMapLinkDisplayText('single')}
    </button>
  );
}

// Specialized component for route-level map links
interface RouteMapLinkProps {
  stops: Array<{
    sequence: number;
    address: string;
    customer: { name: string };
  }>;
  variant?: 'button' | 'link';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

export function RouteMapLink({
  stops,
  variant = 'button',
  size = 'md',
  className = '',
  children
}: RouteMapLinkProps) {
  // Import route generation function
  const { generateFullRouteMapLink, extractRouteDataFromStops } = require('@/utils/googleMapsUtils');
  
  if (!stops || stops.length === 0) {
    return null;
  }

  // Generate route data and map link
  const routeData = extractRouteDataFromStops(stops);
  const routeMapLink = generateFullRouteMapLink(routeData);

  if (!routeMapLink) {
    return null;
  }

  // Handle click event
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (GOOGLE_MAPS_CONFIG.OPEN_IN_NEW_TAB) {
      window.open(routeMapLink, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = routeMapLink;
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  if (variant === 'link') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline transition-colors ${className}`}
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        {children || getMapLinkDisplayText('route', stops.length)}
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors ${sizeClasses[size]} ${className}`}
      title={`View full route with ${stops.length} stops`}
    >
      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
      {children || getMapLinkDisplayText('route', stops.length)}
    </button>
  );
}
