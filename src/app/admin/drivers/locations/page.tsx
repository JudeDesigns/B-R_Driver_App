'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

interface DriverLocation {
  id: string;
  username: string;
  fullName: string | null;
  lastKnownLatitude: number;
  lastKnownLongitude: number;
  lastLocationUpdate: string;
  locationAccuracy: number | null;
  routes?: Array<{
    id: string;
    routeNumber: string | null;
    date: string;
    status: string;
  }>;
}

export default function DriverLocationsPage() {
  const { token, userRole, isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  // Initialize socket
  const { isConnected, joinRoom, subscribe } = useSocket(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  const fetchDriverLocations = async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!isAutoRefresh) router.push('/admin/login');
        return;
      }

      const params = new URLSearchParams();
      if (activeOnly) params.append('activeOnly', 'true');

      const response = await fetch(`/api/admin/drivers/locations?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch driver locations');
      }

      const data = await response.json();
      setDrivers(data.drivers);
      setLastRefresh(new Date());
    } catch (err) {
      if (!isAutoRefresh) setError((err as Error).message);
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDriverLocations();

      // Set up polling (every 30 seconds)
      pollingInterval.current = setInterval(() => {
        fetchDriverLocations(true);
      }, 30000);
    }

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [isAuthenticated, activeOnly]);

  useEffect(() => {
    if (isConnected && isAuthenticated) {
      joinRoom('admin');

      // Listen for real-time location updates
      const unsubscribe = subscribe('DRIVER_LOCATION_UPDATED', (data: any) => {
        console.log('Real-time location update received:', data);

        setDrivers(prevDrivers => {
          // Check if driver already in list
          const existingDriverIndex = prevDrivers.findIndex(d => d.id === data.driverId);

          if (existingDriverIndex !== -1) {
            // Update existing driver
            const updatedDrivers = [...prevDrivers];
            updatedDrivers[existingDriverIndex] = {
              ...updatedDrivers[existingDriverIndex],
              lastKnownLatitude: data.latitude,
              lastKnownLongitude: data.longitude,
              lastLocationUpdate: data.timestamp,
              locationAccuracy: data.accuracy,
            };
            return updatedDrivers;
          } else if (!activeOnly) {
            // Add new driver if not filtering for active only (or let polling handle it)
            // For now, let's just trigger a silent refresh to be safe and consistent with filters
            fetchDriverLocations(true);
            return prevDrivers;
          }

          return prevDrivers;
        });

        setLastRefresh(new Date());
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isConnected, isAuthenticated, joinRoom, subscribe, activeOnly]);

  if (authLoading) {
    return <AuthLoadingSpinner message="Loading driver locations..." />;
  }

  if (!authLoading && !isAuthenticated) {
    return <AccessDenied title="Access Denied" message="Admin access required" />;
  }

  const getTimeSinceUpdate = (timestamp: string) => {
    const now = new Date();
    const updateTime = new Date(timestamp);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const openInGoogleMaps = (lat: number, lng: number, driverName: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Driver Locations</h1>
        <p className="text-gray-600 mt-2">
          View last known locations of active drivers
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active drivers only (last 30 min)</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            {lastRefresh && (
              <span className="text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchDriverLocations(false)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Driver List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading && drivers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading driver locations...</p>
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">No active drivers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Update
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {driver.fullName || driver.username}
                        </div>
                        {driver.fullName && (
                          <div className="text-sm text-gray-500">@{driver.username}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {driver.lastKnownLatitude.toFixed(6)}, {driver.lastKnownLongitude.toFixed(6)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getTimeSinceUpdate(driver.lastLocationUpdate)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(driver.lastLocationUpdate).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {driver.locationAccuracy ? `±${Math.round(driver.locationAccuracy)}m` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() =>
                          openInGoogleMaps(
                            driver.lastKnownLatitude,
                            driver.lastKnownLongitude,
                            driver.fullName || driver.username
                          )
                        }
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View on Map
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

