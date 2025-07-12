"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents } from "@/lib/socketClient";

interface Route {
  id: string;
  routeNumber: string;
  date: string;
  status: string;
  _count: {
    stops: number;
  };
}

interface RoutesResponse {
  routes: Route[];
  totalCount: number;
  limit: number;
  offset: number;
}

export default function DriverRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const router = useRouter();

  // Initialize socket connection
  const { isConnected, joinRoom, subscribe } = useSocket();

  useEffect(() => {
    // Get the token from localStorage
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Define fetchRoutes as a useCallback to avoid dependency issues
  const fetchRoutes = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      // Build the query string
      const queryParams = new URLSearchParams();
      if (dateFilter) queryParams.append("date", dateFilter);
      if (statusFilter) queryParams.append("status", statusFilter);
      queryParams.append("limit", limit.toString());
      queryParams.append("offset", offset.toString());

      const response = await fetch(
        `/api/driver/routes?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Add cache: 'no-store' to prevent caching
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch routes");
      }

      const data: RoutesResponse = await response.json();
      setRoutes(data.routes);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [token, limit, offset, dateFilter, statusFilter]);

  useEffect(() => {
    if (token) {
      fetchRoutes();
    }
  }, [token, fetchRoutes]);

  // Set up WebSocket connection and event listeners
  useEffect(() => {
    if (!isConnected) return;

    console.log("Setting up WebSocket connection for driver routes page");

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

    // Join the admin room to receive route updates
    joinRoom("admin");

    // Subscribe to route status update events
    const unsubscribeRouteStatus = subscribe(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data: any) => {
        console.log("Received route status update event:", data);
        // Refresh routes to get the latest status
        fetchRoutes();
      }
    );

    // Subscribe to stop status update events
    const unsubscribeStopStatus = subscribe(
      SocketEvents.STOP_STATUS_UPDATED,
      (data: any) => {
        console.log("Received stop status update event:", data);
        // Refresh routes to get the latest stop status
        fetchRoutes();
      }
    );

    return () => {
      unsubscribeRouteStatus();
      unsubscribeStopStatus();
    };
  }, [isConnected, joinRoom, subscribe, fetchRoutes]);

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(parseInt(e.target.value));
    setOffset(0); // Reset to first page when changing limit
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
    setOffset(0); // Reset to first page when changing filter
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatusFilter(e.target.value);
    setOffset(0); // Reset to first page when changing filter
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleStartRoute = async (routeId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/driver/routes/${routeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update route status");
      }

      // Refresh the routes list
      fetchRoutes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Routes</h1>
        <button
          onClick={() => router.push("/driver")}
          className="text-blue-500 hover:text-blue-600 transition duration-200"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">Route List</h2>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={handleDateFilterChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px] flex items-end">
              <button
                onClick={() => {
                  setDateFilter("");
                  setStatusFilter("");
                  setOffset(0);
                }}
                className="py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No routes found. Try adjusting your filters or check back later.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Route #
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Date
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Stops
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routes.map((route) => (
                      <tr key={route.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {route.routeNumber || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(route.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                              route.status
                            )}`}
                          >
                            {route.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {route._count.stops}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/driver/routes/${route.id}`}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            View
                          </Link>
                          {route.status === "PENDING" && (
                            <button
                              onClick={() => handleStartRoute(route.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Start
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center">
                  <span className="text-sm text-gray-700">
                    Showing <span className="font-medium">{offset + 1}</span> to{" "}
                    <span className="font-medium">
                      {Math.min(offset + limit, totalCount)}
                    </span>{" "}
                    of <span className="font-medium">{totalCount}</span> routes
                  </span>
                  <select
                    value={limit}
                    onChange={handleLimitChange}
                    className="ml-4 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
                  >
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                  </select>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      handlePageChange(Math.max(0, offset - limit))
                    }
                    disabled={offset === 0}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(offset + limit)}
                    disabled={offset + limit >= totalCount}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
