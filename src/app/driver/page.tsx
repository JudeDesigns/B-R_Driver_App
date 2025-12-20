"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSocket } from "@/contexts/SocketContext";
import { getPSTDateString } from "@/lib/timezone";
import { SocketEvents, RouteStatusUpdateData } from "@/lib/socketClient";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
// Performance monitoring removed for cleaner codebase

export default function DriverDashboard() {
  // Simple mobile detection
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const [route, setRoute] = useState(null);

  // Initialize automatic token refresh for drivers
  useTokenRefresh({
    enabled: true,
    onTokenRefreshed: (newToken) => {
      console.log('Driver token refreshed successfully');
    },
    onRefreshFailed: () => {
      console.log('Driver token refresh failed, will redirect to login');
    },
  });
  const [loading, setLoading] = useState(true);
  const [error] = useState("");
  const [safetyCheckCompleted, setSafetyCheckCompleted] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [pendingDocuments, setPendingDocuments] = useState(0);

  // Attendance status state
  const [attendanceStatus, setAttendanceStatus] = useState<{
    isClockedIn: boolean;
    message: string;
    warning: string | null;
    enforcementMode: string;
    lastChecked: string;
    source: string;
  } | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Initialize socket connection
  const { isConnected, joinRoom, subscribe } = useSocket();

  useEffect(() => {
    // Check if user is logged in and has driver role
    try {
      // Check both localStorage and sessionStorage, with preference for sessionStorage for drivers
      let storedToken, userRole, userName;

      // First check sessionStorage (preferred for drivers)
      storedToken = sessionStorage.getItem("token");
      userRole = sessionStorage.getItem("userRole");
      userName = sessionStorage.getItem("username");

      // If not found in sessionStorage, check localStorage
      if (!storedToken) {
        storedToken = localStorage.getItem("token");
        userRole = localStorage.getItem("userRole");
        userName = localStorage.getItem("username");
      }

      if (!storedToken || userRole !== "DRIVER") {
        console.log("Driver authentication failed, redirecting to login");
        router.push("/login");
      } else {
        console.log("Driver authenticated successfully");
        setUsername(userName);
        setToken(storedToken);
      }
    } catch (error) {
      console.error("Error checking driver authentication:", error);
      router.push("/login");
    }
  }, [router]);

  // Fetch attendance status
  const fetchAttendanceStatus = useCallback(async () => {
    if (!token) return;

    setAttendanceLoading(true);
    try {
      const response = await fetch("/api/driver/attendance/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        setAttendanceStatus(data);
      }
    } catch (error) {
      console.error("Error fetching attendance status:", error);
    } finally {
      setAttendanceLoading(false);
    }
  }, [token]);

  // Use useCallback to memoize the function and prevent unnecessary re-renders
  const fetchAssignedRoutes = useCallback(async () => {
    if (!token) return;

    setLoading(true);

    try {
      // Get today's date in PST timezone in YYYY-MM-DD format
      const today = getPSTDateString();

      // Fetch routes
      const routesResponse = await fetch(
        `/api/driver/assigned-routes?date=${today}&t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Disable caching to prevent stale route data
          cache: "no-store",
        }
      );

      if (!routesResponse.ok) {
        const errorData = await routesResponse.json();
        throw new Error(errorData.message || "Failed to fetch routes");
      }

      const routesData = await routesResponse.json();
      // Don't set routes here - wait for safety check data to set proper status

      // Check if any safety checks are completed
      const safetyChecksResponse = await fetch(
        `/api/driver/safety-check/status?date=${today}&t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Disable caching for safety check status to prevent cross-driver issues
          cache: "no-store",
        }
      );

      if (safetyChecksResponse.ok) {
        const safetyData = await safetyChecksResponse.json();
        setSafetyCheckCompleted(safetyData.hasCompletedChecks || false);

        // Update route status based on driver-specific safety check completion
        if (routesData.routes && routesData.routes.length > 0) {
          const updatedRoutes = routesData.routes.map((route: any) => ({
            ...route,
            status: safetyData.completedRouteIds.includes(route.id) ? "IN_PROGRESS" : "PENDING"
          }));
          setRoutes(updatedRoutes);

          // Update the current route as well
          if (updatedRoutes.length > 0) {
            setRoute(updatedRoutes[0]);
          }
        }
      } else {
        // If safety check API fails, set routes with default PENDING status
        if (routesData.routes && routesData.routes.length > 0) {
          const routesWithStatus = routesData.routes.map((route: any) => ({
            ...route,
            status: "PENDING"
          }));
          setRoutes(routesWithStatus);
          setRoute(routesWithStatus[0]);
        }
      }

      // Fetch document counts
      const documentsResponse = await fetch("/api/driver/documents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: isMobile ? "force-cache" : "default",
      });

      if (documentsResponse.ok) {
        const documentsData = await documentsResponse.json();
        const pending = documentsData.reduce((total: number, stop: any) => {
          return total + stop.stopDocuments.filter((doc: any) => !doc.isPrinted).length;
        }, 0);
        setPendingDocuments(pending);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [token, isMobile]); // Add dependencies

  // Fetch routes and attendance status when token is available
  useEffect(() => {
    if (token) {
      fetchAssignedRoutes();
      fetchAttendanceStatus();
    }
  }, [token, fetchAssignedRoutes, fetchAttendanceStatus]);

  // Set up WebSocket connection and event listeners
  useEffect(() => {
    if (!isConnected || !token) return;

    console.log("Setting up WebSocket connection for driver dashboard");

    // Join the driver's room
    if (typeof window !== "undefined") {
      try {
        // Try sessionStorage first (preferred for drivers)
        let userId = sessionStorage.getItem("userId");

        // If not found in sessionStorage, try localStorage
        if (!userId) {
          userId = localStorage.getItem("userId");
        }

        if (userId) {
          console.log("Joining driver room:", `driver:${userId}`);
          joinRoom(`driver:${userId}`);
        }
      } catch (error) {
        console.error("Error getting userId for WebSocket connection:", error);
      }
    }

    // Simple throttling to prevent excessive API calls
    let lastFetchTime = 0;
    const throttledFetchRoutes = () => {
      const now = Date.now();
      if (now - lastFetchTime > 2000) { // Throttle to at most once every 2 seconds
        lastFetchTime = now;
        console.log("Throttled fetch routes called");
        fetchAssignedRoutes();
      }
    };

    // Subscribe to route status update events with throttling for better performance
    const unsubscribeRouteStatus = subscribe<RouteStatusUpdateData>(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data) => {
        console.log("Received route status update event:", data);
        // Use throttled function to refresh routes when any route status changes
        throttledFetchRoutes();
      }
    );

    return () => {
      unsubscribeRouteStatus();
    };
  }, [
    isConnected,
    token,
    joinRoom,
    subscribe,
    fetchAssignedRoutes,
  ]);

  const handleLogout = () => {
    // Clear both localStorage and sessionStorage
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("storageType");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("storageType");

    console.log("Driver logged out successfully");
    // Force a page reload to clear any cached state
    window.location.href = "/login";
  };

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20 mobile-spacing">
      <div className="flex justify-between items-center mt-4">
        <h1 className="text-xl font-medium text-black mobile-heading">
          Driver Dashboard
        </h1>
        <div className="flex items-center">
          <span className="text-sm text-gray-600 mobile-text">
            Welcome, {username || "Driver"}
          </span>
        </div>
      </div>

      {/* Attendance Status Banner */}
      {attendanceStatus && !attendanceLoading && (
        <div
          className={`border-l-4 p-4 rounded ${attendanceStatus.isClockedIn
              ? "border-green-500 bg-green-50"
              : attendanceStatus.enforcementMode === "strict"
                ? "border-red-500 bg-red-50"
                : "border-yellow-500 bg-yellow-50"
            }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {attendanceStatus.isClockedIn ? (
                <svg
                  className="h-5 w-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className={`h-5 w-5 ${attendanceStatus.enforcementMode === "strict"
                      ? "text-red-600"
                      : "text-yellow-600"
                    }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <p
                className={`text-sm font-medium ${attendanceStatus.isClockedIn
                    ? "text-green-800"
                    : attendanceStatus.enforcementMode === "strict"
                      ? "text-red-800"
                      : "text-yellow-800"
                  }`}
              >
                {attendanceStatus.message}
              </p>
              {attendanceStatus.warning && (
                <p className="mt-1 text-sm text-gray-600">
                  {attendanceStatus.warning}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Mode: {attendanceStatus.enforcementMode} | Source:{" "}
                {attendanceStatus.source}
              </p>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-lg font-medium text-black mt-3 mobile-heading">
        Today&apos;s Deliveries
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 text-center p-4">{error}</div>
      ) : routes.length > 0 ? (
        <div className="space-y-4">
          {routes.map((route) => (
            <div
              key={route.id}
              className="border border-gray-200 rounded overflow-hidden mobile-card"
            >
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 mobile-text">
                      Route Number
                    </span>
                    <span className="text-sm font-medium mobile-text">
                      {route.routeNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 mobile-text">
                      Date
                    </span>
                    <span className="text-sm font-medium mobile-text">
                      {new Date(route.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 mobile-text">
                      Status
                    </span>
                    <span
                      className={`text-sm font-medium px-3 py-1 rounded-full mobile-status ${route.status === "PENDING"
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
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 mobile-text">
                      Total Stops
                    </span>
                    <span className="text-sm font-medium mobile-text">
                      {route._count?.stops || 0}
                    </span>
                  </div>
                </div>

                {route.status === "PENDING" ? (
                  <div className="mt-8">
                    <div className="border-l-4 border-yellow-300 pl-4 py-2 mb-4 bg-yellow-50">
                      <p className="text-sm text-gray-600 mobile-text">
                        You must complete the safety checklist before starting
                        this route.
                      </p>
                    </div>
                    <Link
                      href="/driver/safety-check"
                      className="w-full block text-center bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 touch-manipulation mobile-button"
                    >
                      Complete Safety Checklist
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/driver/stops"
                    className="w-full block text-center bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 mt-6 touch-manipulation mobile-button"
                  >
                    View Stop Details
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-gray-200 rounded p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-4 text-base font-medium text-black">
            No routes assigned
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            You don&apos;t have any routes assigned for today.
          </p>
          <Link
            href="/driver/stops"
            className="mt-4 inline-block text-blue-600 hover:text-blue-800 transition duration-200"
          >
            View all stops
          </Link>
        </div>
      )}
    </div>
  );
}
