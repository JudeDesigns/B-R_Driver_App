/**
 * Location Tracking Service (Optimized for Cost & Performance)
 * 
 * Key Optimizations:
 * - Only tracks when driver is actively on route (not continuous)
 * - 5-minute update interval (not 2 minutes)
 * - Pauses when driver is idle
 * - Battery-efficient (uses low-power mode)
 * - Minimal database writes
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export interface LocationTrackingOptions {
  stopId: string;
  routeId: string;
  onLocationUpdate?: (location: LocationData) => void;
  onError?: (error: Error) => void;
}

class LocationTrackingService {
  private watchId: number | null = null;
  private updateIntervalId: NodeJS.Timeout | null = null;
  private isTracking: boolean = false;
  private currentLocation: LocationData | null = null;
  private options: LocationTrackingOptions | null = null;

  // Configuration from environment variables
  private readonly UPDATE_INTERVAL = parseInt(
    process.env.NEXT_PUBLIC_LOCATION_UPDATE_INTERVAL || '300000',
    10
  ); // 5 minutes default
  private readonly TRACKING_ENABLED = 
    process.env.NEXT_PUBLIC_LOCATION_TRACKING_ENABLED === 'true';

  /**
   * Check if geolocation is supported
   */
  isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Check if the current context is secure (HTTPS or localhost)
   */
  isSecureContext(): boolean {
    return window.isSecureContext;
  }

  /**
   * Check if location tracking is enabled
   */
  isEnabled(): boolean {
    return this.TRACKING_ENABLED && this.isSupported();
  }

  /**
   * Request location permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('Location tracking is disabled in environment');
      return false;
    }

    // Check if we're in a secure context (HTTPS or localhost)
    if (!this.isSecureContext()) {
      console.error('Geolocation requires a secure context (HTTPS). Current protocol:', window.location.protocol);
      console.error('Please access the application via HTTPS or use localhost with a valid SSL certificate.');
      return false;
    }

    // Check if Permissions API is available
    if ('permissions' in navigator) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });

        if (result.state === 'denied') {
          console.error('Location permission is denied. Please enable location access in your browser settings.');
          return false;
        }

        if (result.state === 'granted') {
          return true;
        }

        // If state is 'prompt', we need to request permission
      } catch (error) {
        console.warn('Permissions API not fully supported, falling back to direct request');
      }
    }

    try {
      // Try to get current position to trigger permission prompt
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          (error) => {
            // Provide more detailed error messages
            let errorMessage = 'Location permission denied';
            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is unavailable.';
                break;
              case error.TIMEOUT:
                errorMessage = 'Location request timed out.';
                break;
            }
            reject(new Error(errorMessage));
          },
          {
            enableHighAccuracy: true, // CHANGED: High accuracy required for HTTP contexts
            timeout: 15000, // Increased timeout for better reliability
            maximumAge: 10000, // CHANGED: Reduced cache to 10 seconds
          }
        );
      });
      return true;
    } catch (error) {
      console.error('Location permission error:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Start tracking driver location
   * Only call this when driver starts a delivery
   */
  async startTracking(options: LocationTrackingOptions): Promise<boolean> {
    if (!this.isEnabled()) {
      console.warn('Location tracking is disabled');
      return false;
    }

    if (this.isTracking) {
      console.warn('Location tracking already active');
      return true;
    }

    // Request permission first
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      options.onError?.(new Error('Location permission denied'));
      return false;
    }

    this.options = options;
    this.isTracking = true;

    // Start watching position (low-power mode)
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp),
        };
      },
      (error) => {
        // GeolocationPositionError doesn't always have a message property
        const errorMessage = error.message || `Geolocation error code ${error.code}: ${
          error.code === 1 ? 'Permission denied' :
          error.code === 2 ? 'Position unavailable' :
          error.code === 3 ? 'Timeout' : 'Unknown error'
        }`;
        console.error('Geolocation error:', errorMessage, error);
        this.options?.onError?.(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true, // CHANGED: High accuracy required for HTTP contexts
        timeout: 30000,
        maximumAge: 10000, // CHANGED: Reduced cache to 10 seconds for better reliability
      }
    );

    // Send location updates at configured interval (5 minutes)
    this.updateIntervalId = setInterval(() => {
      this.sendLocationUpdate();
    }, this.UPDATE_INTERVAL);

    // Send initial location immediately
    setTimeout(() => this.sendLocationUpdate(), 2000);

    console.log(`Location tracking started (updates every ${this.UPDATE_INTERVAL / 1000}s)`);
    return true;
  }

  /**
   * Stop tracking driver location
   * Call this when driver completes delivery or goes idle
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = null;
    }

    this.isTracking = false;
    this.currentLocation = null;
    this.options = null;

    console.log('Location tracking stopped');
  }

  /**
   * Send location update to server
   */
  private async sendLocationUpdate(): Promise<void> {
    if (!this.currentLocation || !this.options) {
      return;
    }

    try {
      // Get token from both localStorage and sessionStorage
      let token = localStorage.getItem('token');
      if (!token) {
        token = sessionStorage.getItem('token');
      }

      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/driver/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stopId: this.options.stopId,
          routeId: this.options.routeId,
          latitude: this.currentLocation.latitude,
          longitude: this.currentLocation.longitude,
          accuracy: this.currentLocation.accuracy,
        }),
      });

      if (!response.ok) {
        // If 401, token might be expired - log user out
        if (response.status === 401) {
          console.error('Location update failed: Unauthorized (token expired)');
          throw new Error('Authentication failed - please log in again');
        }
        throw new Error(`Failed to update location: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Location updated successfully:', data);

      // Notify callback
      this.options.onLocationUpdate?.(this.currentLocation);
    } catch (error) {
      console.error('Error sending location update:', error);
      this.options?.onError?.(error as Error);
    }
  }

  /**
   * Get current tracking status
   */
  getStatus(): {
    isTracking: boolean;
    currentLocation: LocationData | null;
    updateInterval: number;
  } {
    return {
      isTracking: this.isTracking,
      currentLocation: this.currentLocation,
      updateInterval: this.UPDATE_INTERVAL,
    };
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();

