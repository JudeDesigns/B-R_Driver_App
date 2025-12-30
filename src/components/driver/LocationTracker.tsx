'use client';

import { useEffect, useState } from 'react';
import { locationTrackingService, LocationData } from '@/services/locationTracking';

interface LocationTrackerProps {
  stopId: string;
  routeId: string;
  isActive: boolean; // Only track when true (driver is actively on route)
  onLocationUpdate?: (location: LocationData) => void;
  onError?: (error: Error) => void;
}

/**
 * LocationTracker Component (Optimized for Cost & Performance)
 * 
 * Key Features:
 * - Only tracks when isActive=true (driver is on route)
 * - Automatically stops when isActive=false (driver is idle)
 * - 5-minute update interval (not continuous)
 * - Battery-efficient (low-power mode)
 * - Shows tracking status to driver
 */
export default function LocationTracker({
  stopId,
  routeId,
  isActive,
  onLocationUpdate,
  onError,
}: LocationTrackerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    // Only track when active
    if (isActive && !isTracking) {
      startTracking();
    } else if (!isActive && isTracking) {
      stopTracking();
    }

    // Cleanup on unmount
    return () => {
      if (isTracking) {
        stopTracking();
      }
    };
  }, [isActive, stopId, routeId]);

  const startTracking = async () => {
    if (!locationTrackingService.isEnabled()) {
      setError('Location tracking is disabled');
      return;
    }

    const success = await locationTrackingService.startTracking({
      stopId,
      routeId,
      onLocationUpdate: (location) => {
        setLastUpdate(location.timestamp);
        setError(null);
        onLocationUpdate?.(location);
      },
      onError: (err) => {
        setError(err.message);
        if (err.message.includes('denied')) {
          setPermissionDenied(true);
        }
        onError?.(err);
      },
    });

    if (success) {
      setIsTracking(true);
      setPermissionDenied(false);
    } else {
      setPermissionDenied(true);
      setError('Location permission denied');
    }
  };

  const stopTracking = () => {
    locationTrackingService.stopTracking();
    setIsTracking(false);
  };

  // Don't render anything if tracking is disabled
  if (!locationTrackingService.isEnabled()) {
    return null;
  }

  // Show permission denied message
  if (permissionDenied || error) {
    const isSecureContext = typeof window !== 'undefined' && window.isSecureContext;
    const protocol = typeof window !== 'undefined' ? window.location.protocol : '';

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-yellow-800">
              Location Tracking Unavailable
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              {error || 'Please enable location access in your browser settings to track deliveries.'}
            </p>
            {!isSecureContext && protocol === 'http:' && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700 font-medium">
                  ⚠️ HTTPS Required: Location tracking requires a secure connection (HTTPS).
                </p>
                <p className="text-xs text-red-600 mt-1">
                  You are currently using HTTP. Please access the application via HTTPS for location tracking to work.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show tracking status
  if (isTracking) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative mr-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">
                Location Tracking Active
              </p>
              {lastUpdate && (
                <p className="text-xs text-green-600">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={stopTracking}
            className="text-xs text-green-700 hover:text-green-900 underline"
          >
            Stop
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 mt-2">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Show "Waiting to Start" if enabled but not yet active
  if (!isActive) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-center">
          <svg
            className="w-4 h-4 text-blue-500 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm font-medium text-blue-800">
            Location tracking ready. Starting when delivery begins.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

