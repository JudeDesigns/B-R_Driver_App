"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents } from "@/lib/socketClient";

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
}

interface AdminNote {
  id: string;
  note: string;
  readByDriver: boolean;
  readByDriverAt: string | null;
  createdAt: string;
  admin: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string | null;
  orderNumberWeb: string | null;
  quickbooksInvoiceNum: string | null;
  initialDriverNotes: string | null;
  status: string;
  arrivalTime: string | null;
  completionTime: string | null;
  signedInvoicePdfUrl: string | null;
  driverNotes: string | null;
  isCOD: boolean;
  paymentFlagCash: boolean;
  paymentFlagCheck: boolean;
  paymentFlagCC: boolean;
  paymentFlagNotPaid: boolean;
  returnFlagInitial: boolean;
  driverRemarkInitial: string | null;
  amount: number | null;
  // Driver-recorded payment information
  driverPaymentAmount: number | null;
  driverPaymentMethods: string[];
  customer: Customer;
  adminNotes: AdminNote[];
}

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  stops: Stop[];
}

export default function DriverRouteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
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

  // Define fetchRouteDetails as a useCallback to avoid dependency issues
  const fetchRouteDetails = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      // Use the new endpoint that only returns stops assigned to this driver
      const response = await fetch(
        `/api/driver/routes/${params.id}/assigned-stops`,
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
        throw new Error(errorData.message || "Failed to fetch route details");
      }

      const data = await response.json();
      setRoute(data);

      // If safety check is not completed and route is pending, redirect to safety check
      if (!data.safetyCheckCompleted && data.status === "PENDING") {
        router.push(`/driver/safety-check/${params.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [token, params.id, router]);

  useEffect(() => {
    if (token) {
      fetchRouteDetails();
    }
  }, [token, fetchRouteDetails]);

  // Set up WebSocket connection and event listeners
  useEffect(() => {
    if (!isConnected || !params.id) return;

    console.log("Setting up WebSocket connection for driver route detail page");

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

    // Join the route room
    console.log("Joining route room:", `route:${params.id}`);
    joinRoom(`route:${params.id}`);

    // Subscribe to route status update events
    const unsubscribeRouteStatus = subscribe(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data: any) => {
        console.log("Received route status update event:", data);
        if (data.routeId === params.id) {
          // Refresh route details to get the latest status
          fetchRouteDetails();
        }
      }
    );

    // Subscribe to stop status update events
    const unsubscribeStopStatus = subscribe(
      SocketEvents.STOP_STATUS_UPDATED,
      (data: any) => {
        console.log("Received stop status update event:", data);
        if (data.routeId === params.id) {
          // Refresh route details to get the latest stop status
          fetchRouteDetails();
        }
      }
    );

    // Subscribe to admin note events
    const unsubscribeAdminNote = subscribe(
      SocketEvents.ADMIN_NOTE_CREATED,
      (data: any) => {
        console.log("Received admin note event:", data);
        if (data.routeId === params.id) {
          // Refresh route details to get the latest admin notes
          fetchRouteDetails();
        }
      }
    );

    return () => {
      unsubscribeRouteStatus();
      unsubscribeStopStatus();
      unsubscribeAdminNote();
    };
  }, [isConnected, joinRoom, subscribe, params.id, fetchRouteDetails]);

  const handleCompleteRoute = async () => {
    if (!token || !route) return;

    setUpdatingStatus(true);
    setError("");

    try {
      const response = await fetch(`/api/driver/routes/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "COMPLETED" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update route status");
      }

      // Refresh the route details
      fetchRouteDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUpdatingStatus(false);
    }
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

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "ON_THE_WAY":
        return "bg-blue-100 text-blue-800";
      case "ARRIVED":
        return "bg-purple-100 text-purple-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPaymentMethod = (stop: Stop) => {
    // Check if driver has recorded payments
    if (stop.driverPaymentAmount && stop.driverPaymentAmount > 0) {
      return "Paid";
    }

    // Check legacy payment flags
    if (stop.paymentFlagCash) return "Cash";
    if (stop.paymentFlagCheck) return "Check";
    if (stop.paymentFlagCC) return "Credit Card";
    if (stop.paymentFlagNotPaid) return "Not Paid";
    return "Not Paid";
  };

  const hasUnreadNotes = (stop: Stop) => {
    return stop.adminNotes.some((note) => !note.readByDriver);
  };

  // Calculate total payment amount for the route
  const getTotalPaymentAmount = () => {
    if (!route) return 0;
    return route.stops.reduce((total, stop) => {
      return total + (stop.driverPaymentAmount || 0);
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Route Details {route?.routeNumber ? `- ${route.routeNumber}` : ""}
        </h1>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push("/driver/routes")}
            className="text-blue-500 hover:text-blue-600 transition duration-200"
          >
            &larr; Back to Routes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      ) : route ? (
        <>
          {/* Route Summary */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-700">
                Route Summary
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">
                    Route Number
                  </h3>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {route.routeNumber || "N/A"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Date</h3>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {formatDate(route.date)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Total Payments</h3>
                  <p className="mt-1 text-lg font-semibold text-green-600">
                    ${getTotalPaymentAmount().toFixed(2)}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Status</h3>
                  <div className="mt-1 flex items-center">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                        route.status
                      )}`}
                    >
                      {route.status.replace("_", " ")}
                    </span>

                    {route.status === "IN_PROGRESS" && (
                      <button
                        onClick={handleCompleteRoute}
                        disabled={updatingStatus}
                        className="ml-4 bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-1 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updatingStatus ? "Updating..." : "Complete Route"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stops List */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-700">
                Stops ({route.stops.length})
              </h2>
            </div>
            <div className="p-6">
              {route.stops.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No stops found for this route.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Seq
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Customer
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Invoice #
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
                          Payment
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Notes
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
                      {route.stops
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((stop) => (
                          <tr key={stop.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stop.sequence}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stop.customer.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stop.quickbooksInvoiceNum || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                                  stop.status
                                )}`}
                              >
                                {stop.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {getPaymentMethod(stop)}
                              {stop.isCOD && (
                                <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  COD
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stop.initialDriverNotes && (
                                <span className="mr-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  Driver Notes
                                </span>
                              )}
                              {hasUnreadNotes(stop) && (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                  New Admin Notes
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() =>
                                  router.push(`/driver/stops/${stop.id}`)
                                }
                                className="text-blue-600 hover:text-blue-900"
                              >
                                View
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
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Route not found. It may have been deleted or you may not have
          permission to view it.
        </div>
      )}
    </div>
  );
}
