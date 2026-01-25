'use client';

import { useEffect, useState, useCallback } from 'react';
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
 * - SILENT MODE: No UI shown to driver (tracking runs in background)
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

  // FIX #3: Use useCallback to prevent infinite re-renders (Safari fix)
  const startTracking = useCallback(async () => {
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
  }, [stopId, routeId, onLocationUpdate, onError]);

  // FIX #3: Use useCallback to prevent infinite re-renders (Safari fix)
  const stopTracking = useCallback(() => {
    locationTrackingService.stopTracking();
    setIsTracking(false);
  }, []);

  // FIX #3: Include all dependencies to prevent infinite re-renders (Safari fix)
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
  }, [isActive, isTracking, startTracking, stopTracking]);

  // SILENT MODE: No UI displayed to driver
  // Tracking runs in background without driver knowing

  // Log errors to console for debugging (admin can check browser console if needed)
  if (permissionDenied || error) {
    console.warn('[Location Tracking - Silent Mode] Error:', error || 'Permission denied');
  }

  if (isTracking && lastUpdate) {
    console.log('[Location Tracking - Silent Mode] Active - Last update:', lastUpdate.toLocaleTimeString());
  }

  // Return null - no UI elements shown to driver
  return null;
}

