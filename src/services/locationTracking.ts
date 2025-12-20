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
      return false;
    }

    try {
      // Try to get current position to trigger permission prompt
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // Low-power mode
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        });
      });
      return true;
    } catch (error) {
      console.error('Location permission denied:', error);
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
        console.error('Geolocation error:', error);
        this.options?.onError?.(new Error(error.message));
      },
      {
        enableHighAccuracy: false, // Low-power mode for battery efficiency
        timeout: 30000,
        maximumAge: 60000, // Cache for 1 minute
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
      const token = localStorage.getItem('token');
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

