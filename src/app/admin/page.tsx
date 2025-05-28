"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents } from "@/lib/socketClient";
import WebSocketErrorAlert from "@/components/ui/WebSocketErrorAlert";
import ClientDate from "@/components/ui/ClientDate";

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  };
  _count: {
    stops: number;
  };
}

interface DashboardStats {
  completedStops: number;
  activeRoutes: number;
  activeDrivers: number;
  ongoingDeliveries: number;
}

interface RouteStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
  todayByStatus: Record<string, number>;
}

interface StopStats {
  total: number;
  today: number;
  byStatus: Record<string, number>;
  todayByStatus: Record<string, number>;
}

interface Driver {
  id: string;
  username: string;
  fullName: string | null;
}

interface ActiveDriverDetails {
  count: number;
  drivers: Driver[];
}

export default function AdminDashboard() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    completedStops: 0,
    activeRoutes: 0,
    activeDrivers: 0,
    ongoingDeliveries: 0,
  });
  const [routeStats, setRouteStats] = useState<RouteStats>({
    total: 0,
    today: 0,
    byStatus: {},
    todayByStatus: {},
  });
  const [stopStats, setStopStats] = useState<StopStats>({
    total: 0,
    today: 0,
    byStatus: {},
    todayByStatus: {},
  });
  const [activeDriverDetails, setActiveDriverDetails] =
    useState<ActiveDriverDetails>({
      count: 0,
      drivers: [],
    });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // Initialize socket connection with token
  const [token, setToken] = useState<string | null>(null);
  const {
    isConnected,
    joinRoom,
    subscribe,
    error: socketError,
    reconnect,
  } = useSocket(token);

  // Define fetchDashboardData as a useCallback to avoid dependency issues
  const fetchDashboardData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      console.log("Fetching dashboard data...");
      setLoading(true);
      const response = await fetch("/api/admin/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      console.log("Response status:", response.status);

      // Get the raw text first for debugging
      const responseText = await response.text();
      console.log("Response text:", responseText);

      // If it's not JSON, we'll catch the error below
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse JSON:", parseError);
        throw new Error("Invalid response format from server");
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch dashboard data");
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("Parsed data:", data);
      }
      setRoutes(data.todaysRoutes || []);
      setStats(
        data.stats || {
          completedStops: 0,
          activeRoutes: 0,
          activeDrivers: 0,
          ongoingDeliveries: 0,
        }
      );

      // Set the new state variables
      if (data.routeStats) {
        setRouteStats(data.routeStats);
      }

      if (data.stopStats) {
        setStopStats(data.stopStats);
      }

      if (data.activeDriverDetails) {
        setActiveDriverDetails(data.activeDriverDetails);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authentication and fetch initial data
  useEffect(() => {
    // Check if user is logged in and has admin role
    const storedToken = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");

    if (!storedToken || (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN")) {
      router.push("/login");
      return;
    }

    // Set the token for Socket.IO connection
    setToken(storedToken);

    fetchDashboardData();
  }, [router, fetchDashboardData]);

  // Set up WebSocket connection and event listeners
  useEffect(() => {
    if (!isConnected) return;

    // Join the admin room
    joinRoom("admin");

    // Subscribe to stop status update events
    const unsubscribeStopStatus = subscribe(
      SocketEvents.STOP_STATUS_UPDATED,
      (data: any) => {
        console.log("Received stop status update:", data);
        // Refresh dashboard data to get the latest stats
        fetchDashboardData();
      }
    );

    // Subscribe to route status update events
    const unsubscribeRouteStatus = subscribe(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data: any) => {
        console.log("Received route status update:", data);
        // Refresh dashboard data to get the latest stats
        fetchDashboardData();
      }
    );

    // Cleanup function to unsubscribe from events
    return () => {
      unsubscribeStopStatus();
      unsubscribeRouteStatus();
    };
  }, [isConnected, joinRoom, subscribe, fetchDashboardData]);

  return (
    <div className="space-y-8">
      {/* WebSocket Error Alert */}
      <WebSocketErrorAlert error={socketError} onReconnect={reconnect} />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-medium text-black">Dashboard</h1>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-mono-500 mb-1">
                Stops Completed
              </h2>
              <p className="text-2xl font-semibold text-primary-blue">
                {stats.completedStops}
              </p>
            </div>
            <div className="bg-primary-blue bg-opacity-10 p-3 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary-blue"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-mono-500 mb-1">
                Active Routes
              </h2>
              <p className="text-2xl font-semibold text-primary-purple">
                {stats.activeRoutes}
              </p>
            </div>
            <div className="bg-primary-purple bg-opacity-10 p-3 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary-purple"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-mono-500 mb-1">
                Active Drivers
              </h2>
              <p className="text-2xl font-semibold text-primary-green">
                {stats.activeDrivers}
              </p>
            </div>
            <div className="bg-primary-green bg-opacity-10 p-3 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary-green"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-mono-500 mb-1">
                Ongoing Deliveries
              </h2>
              <p className="text-2xl font-semibold text-primary-orange">
                {stats.ongoingDeliveries}
              </p>
            </div>
            <div className="bg-primary-orange bg-opacity-10 p-3 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary-orange"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Route Status Overview */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">
            Route Status Overview
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">
                Today&apos;s Routes by Status
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-xl font-bold text-gray-900">
                      {routeStats.todayByStatus["PENDING"] || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">In Progress</p>
                    <p className="text-xl font-bold text-blue-600">
                      {routeStats.todayByStatus["IN_PROGRESS"] || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-xl font-bold text-green-600">
                      {routeStats.todayByStatus["COMPLETED"] || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">Cancelled</p>
                    <p className="text-xl font-bold text-red-600">
                      {routeStats.todayByStatus["CANCELLED"] || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">
                Today&apos;s Stops by Status
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">Pending</p>
                    <p className="text-xl font-bold text-gray-900">
                      {stopStats.todayByStatus["PENDING"] || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">On The Way</p>
                    <p className="text-xl font-bold text-blue-600">
                      {stopStats.todayByStatus["ON_THE_WAY"] || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">Arrived</p>
                    <p className="text-xl font-bold text-purple-600">
                      {stopStats.todayByStatus["ARRIVED"] || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-md shadow-sm">
                    <p className="text-sm text-gray-500">Completed</p>
                    <p className="text-xl font-bold text-green-600">
                      {stopStats.todayByStatus["COMPLETED"] || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Drivers */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">Active Drivers</h2>
        </div>
        <div className="p-6">
          {activeDriverDetails.drivers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p>No active drivers today.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {activeDriverDetails.drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="bg-gray-50 p-4 rounded-lg flex items-center"
                >
                  <div className="bg-gray-800 text-white rounded-full h-10 w-10 flex items-center justify-center mr-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {driver.fullName || driver.username}
                    </p>
                    <p className="text-sm text-gray-500">Active</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart and Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Routes - Replacing the Number of Returns section */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-mono-800">
              Today&apos;s Routes
            </h2>
            <Link
              href="/admin/routes"
              className="text-primary-blue hover:text-blue-700 text-sm font-medium"
            >
              View All
            </Link>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
              </div>
            ) : error ? (
              <div className="text-primary-red text-center">{error}</div>
            ) : routes.length === 0 ? (
              <div className="text-gray-700 text-center py-10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 mx-auto text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                <p className="text-gray-900 font-medium">No active routes found.</p>
                <p className="mt-2 text-gray-600">
                  <Link
                    href="/admin/routes/upload"
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Upload a route
                  </Link>{" "}
                  to get started.
                </p>
              </div>
            ) : (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Route
                    </th>
                    {/* Driver column removed as requested */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Stops
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {route.routeNumber || "N/A"}
                      </td>
                      {/* Driver cell removed as requested */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                            route.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-800"
                              : route.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : route.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {route.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {route._count.stops}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-800">
                        <Link href={`/admin/routes/${route.id}`} className="font-medium">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h2 className="text-lg font-medium text-mono-800 mb-6">
            Quick Actions
          </h2>
          <div className="space-y-4">
            <Link
              href="/admin/routes"
              className="block w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-center transition duration-200 font-medium"
            >
              Manage Routes
            </Link>
            <Link
              href="/admin/routes/upload"
              className="block w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-center transition duration-200 font-medium"
            >
              Upload Route
            </Link>
            <Link
              href="/admin/customers"
              className="block w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-center transition duration-200 font-medium"
            >
              Manage Customers
            </Link>
            <Link
              href="/admin/users"
              className="block w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-center transition duration-200 font-medium"
            >
              Manage Users
            </Link>
          </div>

          <div className="mt-8">
            <h3 className="text-mono-600 font-medium mb-4">System Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-mono-500">Database</span>
                <span className="px-2 py-1 text-xs rounded-full bg-primary-green bg-opacity-10 text-primary-green font-medium">
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-mono-500">API Services</span>
                <span className="px-2 py-1 text-xs rounded-full bg-primary-green bg-opacity-10 text-primary-green font-medium">
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-mono-500">Last Update</span>
                <span className="text-sm text-mono-500">
                  <ClientDate />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
