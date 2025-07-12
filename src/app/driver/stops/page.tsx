"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSocket } from "@/hooks/useSocket";
import { SocketEvents } from "@/lib/socketClient";
import Image from "next/image";
import { getPSTDateString } from "@/lib/timezone";

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
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
  customer: Customer;
  route: {
    id: string;
    routeNumber: string | null;
    date: string;
  };
  adminNotes?: Array<{
    id: string;
    note: string;
    createdAt: string;
    readByDriver: boolean;
  }>;
}

export default function DriverStopsPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [safetyCheckCompleted, setSafetyCheckCompleted] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [routesNeedingChecks, setRoutesNeedingChecks] = useState<
    Array<{ id: string; routeNumber: string | null; date: string }>
  >([]);
  const [completedRouteIds, setCompletedRouteIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "map">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"sequence" | "name" | "status">(
    "sequence"
  );
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [weatherData, setWeatherData] = useState<any>(null);
  const [showWeather, setShowWeather] = useState(false);
  const [routeSummary, setRouteSummary] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
  });
  const [allDeliveriesCompleted, setAllDeliveriesCompleted] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Initialize socket connection with token
  const { isConnected, joinRoom, subscribe } = useSocket(null); // Initialize with null, will update in useEffect

  useEffect(() => {
    // Check if user is logged in and has driver role
    try {
      // Check both localStorage and sessionStorage, with preference for sessionStorage for drivers
      let storedToken, userRole;

      // First check sessionStorage (preferred for drivers)
      storedToken = sessionStorage.getItem("token");
      userRole = sessionStorage.getItem("userRole");

      // If not found in sessionStorage, check localStorage
      if (!storedToken) {
        storedToken = localStorage.getItem("token");
        userRole = localStorage.getItem("userRole");
      }

      if (!storedToken || userRole !== "DRIVER") {
        console.log(
          "Driver authentication failed in stops page, redirecting to login"
        );
        router.push("/login");
      } else {
        console.log("Driver authenticated successfully in stops page");
        setToken(storedToken);
      }
    } catch (error) {
      console.error(
        "Error checking driver authentication in stops page:",
        error
      );
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      checkSafetyStatus();
    }
  }, [token]);

  // Set up WebSocket connection and event listeners
  useEffect(() => {
    if (!isConnected || !safetyCheckCompleted) return;

    // Join the driver's room
    let userId;

    try {
      // Try sessionStorage first (preferred for drivers)
      userId = sessionStorage.getItem("userId");

      // If not found in sessionStorage, try localStorage
      if (!userId) {
        userId = localStorage.getItem("userId");
      }

      if (userId) {
        joinRoom(`driver:${userId}`);
      }
    } catch (error) {
      console.error("Error getting userId for WebSocket connection:", error);
    }

    // Subscribe to admin note events
    const unsubscribeAdminNote = subscribe(
      SocketEvents.ADMIN_NOTE_CREATED,
      (data: any) => {
        setHasNewNotifications(true);
        setNotificationMessage("New note from admin");
        setShowNotification(true);

        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);

        // Refresh stops to get the new note
        fetchStops();
      }
    );

    // Subscribe to route status update events
    const unsubscribeRouteStatus = subscribe(
      SocketEvents.ROUTE_STATUS_UPDATED,
      (data: any) => {
        // Refresh stops to get the updated status
        fetchStops();
      }
    );

    // Subscribe to stop status update events
    const unsubscribeStopStatus = subscribe(
      SocketEvents.STOP_STATUS_UPDATED,
      (data: any) => {
        // Show notification
        setNotificationMessage(`Stop status updated to ${data.status}`);
        setShowNotification(true);

        // Auto-hide notification after 5 seconds
        setTimeout(() => {
          setShowNotification(false);
        }, 5000);

        // Refresh stops to get the updated status
        fetchStops();
      }
    );

    return () => {
      unsubscribeAdminNote();
      unsubscribeRouteStatus();
      unsubscribeStopStatus();
    };
  }, [isConnected, safetyCheckCompleted, joinRoom, subscribe]);

  // Filter and sort stops when dependencies change
  useEffect(() => {
    if (!stops.length) return;

    let result = [...stops];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (stop) =>
          stop.customer.name.toLowerCase().includes(term) ||
          stop.customer.address.toLowerCase().includes(term) ||
          (stop.quickbooksInvoiceNum &&
            stop.quickbooksInvoiceNum.toLowerCase().includes(term))
      );
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter((stop) => stop.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === "sequence") {
        return a.sequence - b.sequence;
      } else if (sortBy === "name") {
        return a.customer.name.localeCompare(b.customer.name);
      } else if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

    setFilteredStops(result);

    // Update route summary
    const summary = {
      total: stops.length,
      completed: stops.filter((stop) => stop.status === "COMPLETED").length,
      pending: stops.filter((stop) => stop.status === "PENDING").length,
      inProgress: stops.filter((stop) =>
        ["ON_THE_WAY", "ARRIVED"].includes(stop.status)
      ).length,
    };
    setRouteSummary(summary);

    // Check if all stops are completed
    const allCompleted =
      stops.length > 0 && stops.every((stop) => stop.status === "COMPLETED");

    // Check if we have no stops because they're all completed
    const allStopsCompleted = stops.length === 0 && summary.completed > 0;

    // Update the state to reflect if all deliveries are completed
    setAllDeliveriesCompleted(allCompleted);

    if (allCompleted) {
      console.log("All deliveries completed for today");
    }
  }, [stops, searchTerm, statusFilter, sortBy]);

  // Simulate fetching weather data
  useEffect(() => {
    if (safetyCheckCompleted) {
      // Simulated weather data
      const weatherTypes = ["sunny", "cloudy", "rainy", "stormy", "snowy"];
      const randomWeather =
        weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
      const randomTemp = Math.floor(Math.random() * 30) + 50; // 50-80°F

      setWeatherData({
        type: randomWeather,
        temperature: randomTemp,
        location: "Current Location",
      });
    }
  }, [safetyCheckCompleted]);

  const checkSafetyStatus = async () => {
    if (!token) return;

    try {
      // Get today's date in PST timezone in YYYY-MM-DD format
      const today = getPSTDateString();

      const response = await fetch(
        `/api/driver/safety-check/status?date=${today}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Add cache: 'no-store' to prevent caching
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Safety check status:", data);

        // Store the routes that need safety checks
        setRoutesNeedingChecks(data.routesNeedingChecks || []);
        setCompletedRouteIds(data.completedRouteIds || []);

        // Set overall safety check status
        setSafetyCheckCompleted(data.hasCompletedChecks || false);

        if (data.hasCompletedChecks) {
          // If all safety checks are completed, fetch stops and hide modal
          setShowSafetyModal(false);
          fetchStops();
        } else {
          // If any safety check is not completed, show modal and DO NOT fetch stops
          setShowSafetyModal(true);
          setLoading(false);
          // Clear any existing stops to prevent access
          setStops([]);
        }
      }
    } catch (error) {
      console.error("Error checking safety status:", error);
      setLoading(false);
    }
  };

  const fetchStops = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      // Get today's date in PST timezone in YYYY-MM-DD format
      const today = getPSTDateString();

      const response = await fetch(`/api/driver/stops?date=${today}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch stops");
      }

      const data = await response.json();

      // If we have completed route IDs, filter stops to only show those from routes with completed safety checks
      if (completedRouteIds.length > 0 && !safetyCheckCompleted) {
        // Filter stops to only include those from routes with completed safety checks
        const filteredStops = data.stops.filter((stop: any) =>
          completedRouteIds.includes(stop.routeId)
        );
        console.log(
          "Filtered stops based on completed safety checks:",
          filteredStops.length
        );
        setStops(filteredStops || []);
      } else {
        // If all safety checks are completed or no routes have completed checks, show all stops
        setStops(data.stops || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "ON_THE_WAY":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "ARRIVED":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "COMPLETED":
        return "bg-green-100 text-green-800 border-green-300";
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-300";
      case "FAILED":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "ON_THE_WAY":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        );
      case "ARRIVED":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        );
      case "COMPLETED":
        return (
          <svg
            className="w-5 h-5"
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
        );
      default:
        return (
          <svg
            className="w-5 h-5"
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
        );
    }
  };

  // Notification component for real-time updates
  const Notification = () => {
    if (!showNotification) return null;

    return (
      <div className="fixed top-4 right-4 left-4 md:left-auto md:w-80 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50 animate-fade-in">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-yellow-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">{notificationMessage}</p>
            <p className="text-xs mt-1">Tap to view updates</p>
          </div>
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={() => setShowNotification(false)}
                className="inline-flex rounded-md p-1.5 text-yellow-500 hover:bg-yellow-200 focus:outline-none"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Weather widget component
  const WeatherWidget = () => {
    if (!weatherData) return null;

    const getWeatherIcon = () => {
      switch (weatherData.type) {
        case "sunny":
          return (
            <svg
              className="w-8 h-8 text-yellow-500"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
          );
        case "cloudy":
          return (
            <svg
              className="w-8 h-8 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
            </svg>
          );
        case "rainy":
          return (
            <svg
              className="w-8 h-8 text-blue-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
              <path d="M9 17a1 1 0 11-2 0 1 1 0 012 0zm4 0a1 1 0 11-2 0 1 1 0 012 0zm-8-1a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          );
        case "stormy":
          return (
            <svg
              className="w-8 h-8 text-yellow-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
            </svg>
          );
        case "snowy":
          return (
            <svg
              className="w-8 h-8 text-blue-200"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 16h-8z" />
              <path d="M10 12a1 1 0 100-2 1 1 0 000 2zm3-1a1 1 0 10-2 0 1 1 0 002 0zm-6 0a1 1 0 10-2 0 1 1 0 002 0z" />
            </svg>
          );
        default:
          return null;
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between">
        <div className="flex items-center">
          {getWeatherIcon()}
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">
              {weatherData.temperature}°F
            </p>
            <p className="text-xs text-gray-500">{weatherData.location}</p>
          </div>
        </div>
        <div className="text-xs text-gray-500 capitalize">
          {weatherData.type}
        </div>
      </div>
    );
  };

  // Safety modal component
  const SafetyCheckModal = () => {
    // Format date for display in PST timezone
    const formatRouteDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-yellow-400"
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
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Safety Check Required
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              You must complete the safety checklist for each route before you
              can view all your stops. This helps ensure both your safety and
              the safety of others.
            </p>

            {/* Show routes that need safety checks */}
            {routesNeedingChecks.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Routes Needing Safety Checks:
                </h4>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="divide-y divide-gray-200">
                    {routesNeedingChecks.map((route) => (
                      <li
                        key={route.id}
                        className="py-2 flex justify-between items-center"
                      >
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-800">
                            Route {route.routeNumber || "Unknown"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatRouteDate(route.date)}
                          </p>
                        </div>
                        <Link
                          href={`/driver/safety-check?routeId=${route.id}`}
                          className="text-xs bg-black text-white px-3 py-1 rounded hover:bg-gray-800 transition duration-200"
                        >
                          Complete
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Show message about completed routes */}
            {completedRouteIds.length > 0 && (
              <div className="mt-4 text-xs text-green-600">
                <p>
                  You have completed safety checks for{" "}
                  {completedRouteIds.length} route(s).
                </p>
                <p>You can view stops for these routes below.</p>
              </div>
            )}
          </div>
          <div className="mt-6">
            <Link
              href="/driver/safety-check"
              className="w-full block text-center bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200"
            >
              Complete Safety Checklist
            </Link>
            <button
              onClick={() => router.push("/driver")}
              className="w-full block text-center bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded mt-3 hover:bg-gray-50 transition duration-200"
            >
              Back to Dashboard
            </button>
            {completedRouteIds.length > 0 && (
              <button
                onClick={() => setShowSafetyModal(false)}
                className="w-full block text-center bg-white text-gray-700 font-medium py-3 px-4 rounded mt-3 hover:bg-gray-50 transition duration-200"
              >
                View Available Stops
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 pb-20 px-3 sm:px-6">
      {/* Notification */}
      <Notification />

      {/* Fixed Header for Mobile */}
      <div className="sticky top-0 z-10 bg-white shadow-md rounded-lg p-3 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => router.push("/driver")}
              className="mr-2 p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition duration-200 touch-manipulation"
              aria-label="Back to Dashboard"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              Today&apos;s Deliveries
            </h1>
            {hasNewNotifications && (
              <span className="ml-2 relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>

          {safetyCheckCompleted && !loading && stops.length > 0 && (
            <button
              onClick={() => setShowWeather(!showWeather)}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition duration-200 touch-manipulation"
              aria-label="Toggle Weather"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* View Mode Tabs - Mobile Optimized */}
        {safetyCheckCompleted && !loading && stops.length > 0 && (
          <div className="flex justify-between mt-3 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition duration-200 touch-manipulation ${
                viewMode === "list"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              }`}
              aria-label="List View"
            >
              <div className="flex items-center justify-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
                <span>List</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition duration-200 touch-manipulation ${
                viewMode === "grid"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              }`}
              aria-label="Grid View"
            >
              <div className="flex items-center justify-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                <span>Grid</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition duration-200 touch-manipulation ${
                viewMode === "map"
                  ? "bg-black text-white shadow-sm"
                  : "text-gray-700 hover:bg-gray-200 active:bg-gray-300"
              }`}
              aria-label="Map View"
            >
              <div className="flex items-center justify-center">
                <svg
                  className="w-4 h-4 mr-1"
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
                <span>Map</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Weather widget (conditionally shown) */}
      {showWeather && safetyCheckCompleted && !loading && stops.length > 0 && (
        <div className="animate-fade-in">
          <WeatherWidget />
        </div>
      )}

      {/* Search and filters */}
      {safetyCheckCompleted && !loading && stops.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 space-y-3 sm:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search stops..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-base mobile-input"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg
                  className="h-5 w-5 text-gray-400 hover:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Status Filter Pills - Scrollable on Mobile */}
          <div className="flex overflow-x-auto pb-2 hide-scrollbar">
            <div className="flex space-x-2 min-w-max">
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  !statusFilter
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300"
                } transition duration-200 touch-manipulation`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("PENDING")}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  statusFilter === "PENDING"
                    ? "bg-yellow-500 text-white"
                    : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 active:bg-yellow-300"
                } transition duration-200 touch-manipulation`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter("ON_THE_WAY")}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  statusFilter === "ON_THE_WAY"
                    ? "bg-blue-500 text-white"
                    : "bg-blue-100 text-blue-800 hover:bg-blue-200 active:bg-blue-300"
                } transition duration-200 touch-manipulation whitespace-nowrap`}
              >
                On The Way
              </button>
              <button
                onClick={() => setStatusFilter("ARRIVED")}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  statusFilter === "ARRIVED"
                    ? "bg-purple-500 text-white"
                    : "bg-purple-100 text-purple-800 hover:bg-purple-200 active:bg-purple-300"
                } transition duration-200 touch-manipulation`}
              >
                Arrived
              </button>
              <button
                onClick={() => setStatusFilter("COMPLETED")}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  statusFilter === "COMPLETED"
                    ? "bg-green-500 text-white"
                    : "bg-green-100 text-green-800 hover:bg-green-200 active:bg-green-300"
                } transition duration-200 touch-manipulation`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Sort and Count - Stacked on Mobile */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="text-sm text-gray-500 font-medium">
              Showing {filteredStops.length} of {stops.length} stops
            </div>

            <div className="flex items-center w-full sm:w-auto">
              <label
                htmlFor="sort-select"
                className="text-sm text-gray-500 mr-2 whitespace-nowrap"
              >
                Sort by:
              </label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-sm border border-gray-300 rounded-md py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent flex-grow sm:flex-grow-0"
              >
                <option value="sequence">Sequence</option>
                <option value="name">Customer Name</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Add custom styles for hiding scrollbar but allowing scroll */}
      <style jsx global>{`
        .hide-scrollbar {
          -ms-overflow-style: none; /* IE and Edge */
          scrollbar-width: none; /* Firefox */
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome, Safari and Opera */
        }
        .touch-manipulation {
          touch-action: manipulation;
        }
      `}</style>

      {/* Route summary cards */}
      {safetyCheckCompleted && !loading && stops.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Stops</p>
                <p className="text-2xl font-bold text-gray-900">
                  {routeSummary.total}
                </p>
              </div>
              <div className="p-3 bg-gray-100 rounded-full">
                <svg
                  className="w-6 h-6 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {routeSummary.pending}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <svg
                  className="w-6 h-6 text-yellow-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-blue-500">
                  {routeSummary.inProgress}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-green-500">
                  {routeSummary.completed}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg
                  className="w-6 h-6 text-green-500"
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
      )}

      {/* Map View */}
      {viewMode === "map" &&
        safetyCheckCompleted &&
        !loading &&
        stops.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-medium text-gray-800">Route Map</h2>
              <span className="text-xs text-gray-500">
                Interactive map view
              </span>
            </div>
            <div
              ref={mapRef}
              className="h-96 bg-gray-100 relative flex items-center justify-center"
            >
              <div className="text-center p-6 max-w-md">
                <svg
                  className="w-16 h-16 text-gray-400 mx-auto mb-4"
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Interactive Map
                </h3>
                <p className="text-gray-600 mb-4">
                  This would display an interactive map with all your stops for
                  the day, showing the optimal route and current location.
                </p>
                <p className="text-sm text-gray-500">
                  For demonstration purposes only. In a production environment,
                  this would integrate with Google Maps or a similar mapping
                  service.
                </p>
              </div>

              {/* Map Markers (Simulated) */}
              {filteredStops.map((stop, index) => (
                <div
                  key={stop.id}
                  className={`absolute w-8 h-8 rounded-full flex items-center justify-center border-2 ${getStatusBadgeClass(
                    stop.status
                  )}`}
                  style={{
                    top: `${20 + ((index * 15) % 70)}%`,
                    left: `${15 + ((index * 20) % 70)}%`,
                    transform: "translate(-50%, -50%)",
                    transition: "all 0.3s ease-in-out",
                    zIndex: index === 0 ? 10 : index,
                  }}
                >
                  <span className="text-xs font-bold">{stop.sequence}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Grid View */}
      {viewMode === "grid" &&
        safetyCheckCompleted &&
        !loading &&
        stops.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredStops.map((stop) => (
              <div
                key={stop.id}
                className="bg-white rounded-lg shadow-md overflow-hidden transform transition duration-300 hover:shadow-lg hover:-translate-y-1 mobile-card touch-manipulation"
              >
                <div
                  className={`h-3 ${
                    getStatusBadgeClass(stop.status).split(" ")[0]
                  }`}
                ></div>
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-medium text-gray-900 truncate pr-2 text-base">
                      {stop.customer.name}
                    </h3>
                    <div
                      className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                        stop.status
                      )}`}
                    >
                      <span className="mr-1.5">
                        {getStatusIcon(stop.status)}
                      </span>
                      <span>{stop.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-4 truncate">
                    {stop.customer.address}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mb-4">
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <span>{stop.quickbooksInvoiceNum || "No Invoice"}</span>
                    </div>
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                        />
                      </svg>
                      <span>{stop.adminNotes?.length || 0} Notes</span>
                    </div>
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1.5 text-gray-400"
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
                      <span>Stop #{stop.sequence}</span>
                    </div>
                    <div className="flex items-center">
                      <svg
                        className="w-4 h-4 mr-1.5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        {stop.amount ? `$${stop.amount.toFixed(2)}` : "N/A"}
                      </span>
                    </div>
                  </div>

                  {stop.initialDriverNotes && (
                    <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mb-4 max-h-20 overflow-y-auto">
                      <p className="font-medium mb-1.5">
                        Delivery Instructions:
                      </p>
                      <p>{stop.initialDriverNotes}</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-5">
                    <div className="flex space-x-2">
                      {stop.isCOD && (
                        <span className="px-2.5 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                          COD
                        </span>
                      )}
                      {stop.paymentFlagCash && (
                        <span className="px-2.5 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                          Cash
                        </span>
                      )}
                      {stop.paymentFlagCheck && (
                        <span className="px-2.5 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          Check
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/driver/stops/${stop.id}`}
                      className="inline-flex items-center px-4 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 active:bg-gray-900 transition duration-200 touch-manipulation"
                    >
                      <span>Details</span>
                      <svg
                        className="ml-1.5 w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* List View */}
      {viewMode === "list" &&
        safetyCheckCompleted &&
        !loading &&
        stops.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-medium text-gray-800">Today's Stops</h2>
              <span className="text-xs text-gray-500">
                {filteredStops.length} stops
              </span>
            </div>
            <ul className="divide-y divide-gray-200">
              {filteredStops.map((stop) => (
                <li
                  key={stop.id}
                  className="p-5 hover:bg-gray-50 transition duration-150"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="flex-1">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-4">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${getStatusBadgeClass(
                              stop.status
                            )}`}
                          >
                            {stop.sequence}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 text-base">
                            {stop.customer.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1.5">
                            {stop.customer.address}
                          </p>
                          {stop.initialDriverNotes && (
                            <div className="mt-3 text-xs text-blue-800 flex items-start">
                              <svg
                                className="w-4 h-4 mr-1.5 flex-shrink-0 mt-0.5 text-blue-500"
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
                              <span className="line-clamp-2">
                                {stop.initialDriverNotes}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-3 mt-4 sm:mt-0">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                          stop.status
                        )}`}
                      >
                        <span className="mr-1.5">
                          {getStatusIcon(stop.status)}
                        </span>
                        <span>{stop.status.replace("_", " ")}</span>
                      </span>

                      <div className="flex items-center text-xs text-gray-500">
                        <svg
                          className="w-4 h-4 mr-1.5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        <span>{stop.quickbooksInvoiceNum || "No Invoice"}</span>
                      </div>

                      <Link
                        href={`/driver/stops/${stop.id}`}
                        className="inline-flex items-center px-4 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 active:bg-gray-900 transition duration-200 mt-1 touch-manipulation"
                      >
                        <span>View Details</span>
                        <svg
                          className="ml-1.5 w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* Safety Modal */}
      {showSafetyModal && <SafetyCheckModal />}

      {/* Loading State */}
      {loading && !showSafetyModal ? (
        <div className="flex justify-center items-center h-60">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-t-2 border-b-2 border-black animate-spin"></div>
            <div
              className="absolute top-0 left-0 h-24 w-24 rounded-full border-t-2 border-b-2 border-gray-300 animate-spin"
              style={{
                animationDirection: "reverse",
                animationDuration: "1.5s",
              }}
            ></div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-500"
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
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error Loading Stops
              </h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      ) : allDeliveriesCompleted ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <svg
            className="mx-auto h-16 w-16 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-medium text-gray-900">
            All Deliveries Completed!
          </h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            You have completed all your deliveries for today. Great job!
          </p>
          <button
            onClick={() => router.push("/driver")}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            Return to Dashboard
          </button>
        </div>
      ) : safetyCheckCompleted && !showSafetyModal && stops.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-medium text-gray-900">
            No stops assigned
          </h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            You don&apos;t have any stops assigned for today. Check back later
            or contact your administrator if you believe this is an error.
          </p>
          <button
            onClick={() => router.push("/driver")}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            Return to Dashboard
          </button>
        </div>
      ) : null}
    </div>
  );
}
