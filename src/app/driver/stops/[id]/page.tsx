"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/contexts/SocketContext";
import {
  useOptimizedStopStatus,
  useOptimizedAdminNotes,
} from "@/hooks/useOptimizedSocketEvents";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Notification from "@/components/ui/Notification";
import WebSocketErrorAlert from "@/components/ui/WebSocketErrorAlert";
import StatusBadge from "@/components/ui/StatusBadge";
import StatusButton from "@/components/driver/StatusButton";
import DriverNotes from "@/components/driver/DriverNotes";
import InvoiceUpload from "@/components/driver/InvoiceUpload";
import EnhancedInvoiceUpload from "@/components/driver/EnhancedInvoiceUpload";
import ReturnManagement from "@/components/driver/ReturnManagement";

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
  onTheWayTime: string | null; // Added for tracking when driver started the delivery
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
  // Payment amounts from Excel
  paymentAmountCash?: number;
  paymentAmountCheck?: number;
  paymentAmountCC?: number;
  totalPaymentAmount?: number;
  // Driver-recorded payment information
  driverPaymentAmount?: number;
  driverPaymentMethods?: string[];
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
    admin: {
      username: string;
      fullName: string | null;
    };
  }>;
}

export default function StopDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Unwrap params with React.use()
  const unwrappedParams = React.use(params as Promise<{ id: string }>);
  const [stop, setStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [driverNotes, setDriverNotes] = useState("");
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [deliveryTimer, setDeliveryTimer] = useState<number | null>(null);

  // Payment recording state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const router = useRouter();

  // Initialize socket connection
  const { isConnected, joinRoom, error: socketError, reconnect } = useSocket();

  // Define fetchStopDetails as a useCallback to avoid dependency issues
  const fetchStopDetails = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/driver/stops/${unwrappedParams.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        // Add cache: 'no-store' to prevent caching
        cache: "no-store",
      });

      if (!response.ok) {
        // Handle non-JSON responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch stop details");
        } else {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
        }
      }

      const data = await response.json();
      setStop(data);
      setDriverNotes(data.driverNotes || "");
    } catch (err) {
      console.error("Error fetching stop details:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [token, unwrappedParams.id]);

  useEffect(() => {
    // This code only runs on the client side
    if (typeof window !== "undefined") {
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
            "Driver authentication failed in stop details page, redirecting to login"
          );
          router.push("/login");
        } else {
          console.log("Driver authenticated successfully in stop details page");
          setToken(storedToken);
        }
      } catch (error) {
        console.error(
          "Error checking driver authentication in stop details page:",
          error
        );
        router.push("/login");
      }
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      fetchStopDetails();
    }
  }, [token, fetchStopDetails]);

  // Effect to handle delivery timer - calculate time from ON_THE_WAY to ARRIVED
  useEffect(() => {
    if (!stop) return;

    // If status is ON_THE_WAY, start a live timer
    if (stop.status === "ON_THE_WAY") {
      // Get the timestamp when the driver started the delivery
      // Use the stored onTheWayTime if available, otherwise use current time
      const onTheWayTimestamp = stop.onTheWayTime
        ? new Date(stop.onTheWayTime).getTime()
        : new Date().getTime();

      // Start a timer to update every second
      const interval = setInterval(() => {
        const currentTime = new Date().getTime();
        const elapsedTime = Math.floor(
          (currentTime - onTheWayTimestamp) / 1000
        ); // in seconds
        setDeliveryTimer(elapsedTime);
      }, 1000);

      return () => clearInterval(interval);
    }
    // If status is ARRIVED, show the time it took from ON_THE_WAY to ARRIVED
    else if (stop.status === "ARRIVED" && stop.arrivalTime) {
      // Calculate the time between when the driver started the delivery and when they arrived
      // Use the stored timestamps for accurate calculation
      if (stop.onTheWayTime && stop.arrivalTime) {
        const onTheWayTime = new Date(stop.onTheWayTime).getTime();
        const arrivalTime = new Date(stop.arrivalTime).getTime();

        const elapsedTime = Math.floor((arrivalTime - onTheWayTime) / 1000); // in seconds
        setDeliveryTimer(elapsedTime);
      } else {
        // Fallback if onTheWayTime is not available
        setDeliveryTimer(0);
      }
    }
    // For COMPLETED status, show the time at the customer location (from ARRIVED to COMPLETED)
    else if (
      stop.status === "COMPLETED" &&
      stop.completionTime &&
      stop.arrivalTime
    ) {
      const arrivalTime = new Date(stop.arrivalTime).getTime();
      const completionTime = new Date(stop.completionTime).getTime();

      const elapsedTime = Math.floor((completionTime - arrivalTime) / 1000); // in seconds
      setDeliveryTimer(elapsedTime);
    } else {
      setDeliveryTimer(null);
    }
  }, [stop]);

  // Use optimized hooks for real-time updates
  useOptimizedStopStatus(
    stop?.id || null,
    stop?.status || null,
    (newStatus) => {
      console.log(
        `[OptimizedSocket] Updating stop status to ${newStatus} without full refetch`
      );
      // Update the stop status in the local state without a full refetch
      if (stop) {
        setStop({
          ...stop,
          status: newStatus,
        });
      }
    }
  );

  // Use optimized admin notes hook
  const { hasNewNotes } = useOptimizedAdminNotes(
    stop?.id || null,
    [], // We're not using the admin notes array directly
    (newNote) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[OptimizedSocket] Received new admin note without full refetch: "${newNote.note}"`
        );
      }
      // Show notification
      setNotificationVisible(true);

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotificationVisible(false);
      }, 5000);

      // Update the admin notes in the local state without a full refetch
      if (stop) {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[OptimizedSocket] Updating admin notes for stop ${stop.id}`
          );
        }
        // Refresh stop details to get the updated admin notes
        fetchStopDetails();
      }
    }
  );

  // Update notification visibility when hasNewNotes changes
  useEffect(() => {
    if (hasNewNotes) {
      setNotificationVisible(true);

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotificationVisible(false);
      }, 5000);
    }
  }, [hasNewNotes]);

  // Set up WebSocket connection for room joining only
  useEffect(() => {
    if (!isConnected || !stop) return;

    console.log(
      "[OptimizedSocket] Setting up WebSocket connection for driver stop detail page"
    );

    // Join the driver's room and the specific route room
    if (typeof window !== "undefined") {
      try {
        // Try sessionStorage first (preferred for drivers)
        let userId = sessionStorage.getItem("userId");

        // If not found in sessionStorage, try localStorage
        if (!userId) {
          userId = localStorage.getItem("userId");
        }

        if (userId) {
          console.log(
            "[OptimizedSocket] Joining driver room:",
            `driver:${userId}`
          );
          joinRoom(`driver:${userId}`);
        }
      } catch (error) {
        console.error(
          "[OptimizedSocket] Error getting userId for WebSocket connection:",
          error
        );
      }
    }

    if (stop.route.id) {
      console.log(
        "[OptimizedSocket] Joining route room:",
        `route:${stop.route.id}`
      );
      joinRoom(`route:${stop.route.id}`);
    }

    // No need to subscribe to events here as the optimized hooks handle that
    return () => {
      // No cleanup needed for subscriptions as they're handled by the hooks
    };
  }, [isConnected, stop, joinRoom]);

  const updateStatus = async (newStatus: string) => {
    if (!token || !stop) return;

    setUpdatingStatus(true);
    setError("");

    try {
      const updateData: {
        status: string;
        arrivalTime?: string;
        completionTime?: string;
      } = {
        status: newStatus,
      };

      // Set arrival time if status is ARRIVED
      if (newStatus === "ARRIVED" && !stop.arrivalTime) {
        updateData.arrivalTime = new Date().toISOString();
      }

      // Set completion time if status is COMPLETED
      if (newStatus === "COMPLETED" && !stop.completionTime) {
        updateData.completionTime = new Date().toISOString();
      }

      const response = await fetch(`/api/driver/stops/${unwrappedParams.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        // Handle non-JSON responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to update status");
        } else {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
        }
      }

      // Refresh stop details
      fetchStopDetails();
    } catch (err) {
      console.error("Error updating status:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveDriverNotes = async (notes: string) => {
    if (!token || !stop) return;

    setError("");

    try {
      const response = await fetch(`/api/driver/stops/${unwrappedParams.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverNotes: notes,
        }),
      });

      if (!response.ok) {
        // Handle non-JSON responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to save notes");
        } else {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
        }
      }

      // Refresh stop details
      fetchStopDetails();
    } catch (err) {
      console.error("Error saving notes:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      throw err;
    }
  };

  // Handle successful invoice upload
  const handleUploadSuccess = (pdfUrl: string) => {
    // Refresh stop details to get the updated invoice URL and status
    console.log(`Invoice uploaded successfully: ${pdfUrl}`);
    fetchStopDetails();
  };

  // Handle payment recording
  const handleSavePayment = async () => {
    if (!token || !stop) return;

    if (!paymentAmount || selectedPaymentMethods.length === 0) {
      setPaymentError("Please enter payment amount and select at least one payment method");
      return;
    }

    setSavingPayment(true);
    setPaymentError("");

    try {
      const response = await fetch(`/api/driver/stops/${unwrappedParams.id}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverPaymentAmount: parseFloat(paymentAmount),
          driverPaymentMethods: selectedPaymentMethods,
        }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to save payment");
        } else {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      // Reset form and close modal
      setPaymentAmount("");
      setSelectedPaymentMethods([]);
      setShowPaymentModal(false);

      // Refresh stop details
      fetchStopDetails();
    } catch (err) {
      console.error("Error saving payment:", err);
      setPaymentError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSavingPayment(false);
    }
  };

  // Handle payment method selection
  const togglePaymentMethod = (method: string) => {
    setSelectedPaymentMethods(prev =>
      prev.includes(method)
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  const isStatusButtonDisabled = (buttonStatus: string) => {
    if (!stop) return true;
    if (updatingStatus) return true;

    const statusOrder = ["PENDING", "ON_THE_WAY", "ARRIVED", "COMPLETED"];
    const currentIndex = statusOrder.indexOf(stop.status);
    const buttonIndex = statusOrder.indexOf(buttonStatus);

    // Can only progress to the next status in order
    if (buttonIndex !== currentIndex + 1) {
      return true;
    }

    // Additional validation for COMPLETED status
    if (buttonStatus === "COMPLETED") {
      // Check if driver has filled notes and uploaded invoice
      if (!stop.signedInvoicePdfUrl) {
        return true; // Can't complete without uploading invoice
      }

      // Check if driver has arrived
      if (stop.status !== "ARRIVED") {
        return true; // Must be in ARRIVED status to complete
      }
    }

    return false;
  };

  return (
    <div className="max-w-2xl mx-auto pb-24 px-4 sm:px-6 mobile-spacing prevent-pull-refresh">
      {/* WebSocket Error Alert */}
      <WebSocketErrorAlert error={socketError} onReconnect={reconnect} />

      {/* Notification for new admin notes */}
      <Notification
        type="warning"
        title="New note from admin"
        message="You have received a new note from an administrator."
        isVisible={notificationVisible}
        onClose={() => setNotificationVisible(false)}
      />

      {/* Enhanced Header with Status Badge - Mobile Optimized */}
      <div className="bg-white shadow-md rounded-lg mb-6 sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/driver/stops")}
            className="flex items-center text-gray-600 hover:text-black transition-colors touch-manipulation tap-target"
            aria-label="Back to stops list"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Back</span>
            <span className="sm:hidden">Back</span>
          </button>
          {stop && (
            <StatusBadge status={stop.status} className="text-sm px-3 py-1" />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-60 bg-white rounded-lg shadow-md">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-md mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : stop ? (
        <div className="space-y-6">
          {/* Customer Information Card - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-200">
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                    {stop.customer.name}
                  </h1>
                  <div className="flex items-start sm:items-center mt-1 text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5 sm:mt-0"
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
                    <p className="text-sm break-words">
                      {stop.customer.address}
                    </p>
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col justify-between sm:items-end bg-gray-50 sm:bg-transparent p-2 rounded-lg sm:p-0">
                  <div className="flex items-center">
                    <span className="text-xs sm:text-sm font-medium text-gray-500 mr-1 sm:mr-2">
                      Route:
                    </span>
                    <span className="text-xs sm:text-sm font-bold">
                      {stop.route.routeNumber || "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs sm:text-sm font-medium text-gray-500 mr-1 sm:mr-2">
                      Date:
                    </span>
                    <span className="text-xs sm:text-sm">
                      {formatDate(stop.route.date)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {/* Delivery Details - Mobile Optimized */}
              <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-4">
                <div className="col-span-2 sm:col-span-1">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                      Invoice #
                    </span>
                    <span className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {stop.quickbooksInvoiceNum &&
                      stop.quickbooksInvoiceNum.trim() !== ""
                        ? stop.quickbooksInvoiceNum
                        : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                      Order # (Web)
                    </span>
                    <span className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {stop.orderNumberWeb && stop.orderNumberWeb.trim() !== ""
                        ? stop.orderNumberWeb
                        : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="col-span-1">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                      Sequence
                    </span>
                    <span className="font-medium text-gray-900 text-sm sm:text-base">
                      {stop.sequence}
                    </span>
                  </div>
                </div>
                <div className="col-span-1">
                  <div className="flex flex-col">
                    <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                      Amount
                    </span>
                    <span className="font-medium text-gray-900 text-sm sm:text-base">
                      {stop.amount ? `$${stop.amount.toFixed(2)}` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Information - Mobile Optimized */}
              <div className="mt-5 sm:mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 sm:mb-3">
                  Payment Information
                </h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {stop.isCOD && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1"
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
                      <span className="whitespace-nowrap">COD</span>
                    </span>
                  )}
                  {stop.paymentFlagCash && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Cash</span>
                    </span>
                  )}
                  {stop.paymentFlagCheck && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Check</span>
                    </span>
                  )}
                  {stop.paymentFlagCC && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Credit Card</span>
                    </span>
                  )}
                  {stop.paymentFlagNotPaid && (
                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="whitespace-nowrap">Not Paid</span>
                    </span>
                  )}
                  {/* Return flag removed from payment information section as it's not a payment method */}
                </div>

                {/* Payment Recording Section */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-700">Payment Received</h4>
                      {stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? (
                        <div className="mt-1">
                          <div className="text-lg font-bold text-green-600">
                            ${stop.driverPaymentAmount.toFixed(2)}
                          </div>
                          {stop.driverPaymentMethods && stop.driverPaymentMethods.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Methods: {stop.driverPaymentMethods.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 mt-1">
                          No payment recorded yet
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation tap-target"
                    >
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                        />
                      </svg>
                      {stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? "Update Payment" : "Record Payment"}
                    </button>
                  </div>
                </div>
              </div>

              {/* All Instructions - Mobile Optimized */}
              {(stop.initialDriverNotes || (stop.adminNotes && stop.adminNotes.length > 0)) && (
                <div className="mt-5 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5"
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
                    <div className="ml-2 sm:ml-3 w-full">
                      <h3 className="text-sm font-medium text-blue-800">
                        All Instructions
                      </h3>

                      {/* Admin Notes */}
                      {stop.adminNotes && stop.adminNotes.length > 0 && (
                        <div className="mt-2 sm:mt-3">
                          <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wide mb-2 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Admin Instructions:
                          </h4>
                          <div className="space-y-2">
                            {stop.adminNotes.map((note, index) => (
                              <div key={note.id} className="bg-red-100 border border-red-300 rounded p-2 text-sm">
                                <p className="text-red-800 font-medium whitespace-pre-wrap break-words">
                                  {note.note}
                                </p>
                                <p className="text-xs text-red-600 mt-1">
                                  — {note.admin.fullName || note.admin.username} ({new Date(note.createdAt).toLocaleDateString()})
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Driver Instructions */}
                      {stop.initialDriverNotes && (
                        <div className="mt-2 sm:mt-3">
                          <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1 flex items-center">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Delivery Instructions:
                          </h4>
                          <div className="bg-blue-100 border border-blue-300 rounded p-2 text-sm text-blue-800">
                            <p className="whitespace-pre-wrap break-words">{stop.initialDriverNotes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Update - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                Delivery Status
              </h2>
            </div>
            <div className="p-4 sm:p-5">
              {/* Progress Indicator - Mobile Optimized */}
              <div className="relative mb-6 sm:mb-8">
                <div className="overflow-hidden h-2 mb-3 sm:mb-4 text-xs flex rounded bg-gray-200">
                  <div
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      stop.status === "PENDING"
                        ? "bg-gray-400 w-0"
                        : stop.status === "ON_THE_WAY"
                        ? "bg-blue-500 w-1/3"
                        : stop.status === "ARRIVED"
                        ? "bg-yellow-500 w-2/3"
                        : "bg-green-500 w-full"
                    }`}
                  ></div>
                </div>
                <div className="flex justify-between">
                  <div
                    className={`text-xs font-medium ${
                      stop.status === "PENDING"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    Pending
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      stop.status === "ON_THE_WAY"
                        ? "text-blue-600"
                        : "text-gray-500"
                    }`}
                  >
                    <span className="hidden xs:inline">On The Way</span>
                    <span className="xs:hidden">On Way</span>
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      stop.status === "ARRIVED"
                        ? "text-yellow-600"
                        : "text-gray-500"
                    }`}
                  >
                    Arrived
                  </div>
                  <div
                    className={`text-xs font-medium ${
                      stop.status === "COMPLETED"
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    Done
                  </div>
                </div>
              </div>

              {/* Status Buttons - Mobile Optimized */}
              <div className="flex flex-col space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <StatusButton
                    status={stop.status}
                    targetStatus="ON_THE_WAY"
                    currentStatus="PENDING"
                    isUpdating={updatingStatus}
                    isDisabled={isStatusButtonDisabled("ON_THE_WAY")}
                    onClick={() => updateStatus("ON_THE_WAY")}
                    label="Start Delivery"
                    className="h-10 sm:h-12 text-sm sm:text-base touch-manipulation mobile-button"
                  />
                  <StatusButton
                    status={stop.status}
                    targetStatus="ARRIVED"
                    currentStatus="ON_THE_WAY"
                    isUpdating={updatingStatus}
                    isDisabled={isStatusButtonDisabled("ARRIVED")}
                    onClick={() => updateStatus("ARRIVED")}
                    label="Mark as Arrived"
                    className="h-10 sm:h-12 text-sm sm:text-base touch-manipulation mobile-button"
                  />
                </div>
                {/* Complete Delivery button removed - now handled by the InvoiceUpload component */}
              </div>

              {/* Delivery Timer - Mobile Optimized */}
              {deliveryTimer !== null && (
                <div className="mt-5 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center">
                    <svg
                      className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-1.5 sm:mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-blue-800">
                      {stop.status === "ON_THE_WAY"
                        ? "Delivery Time"
                        : stop.status === "ARRIVED"
                        ? "Travel Duration"
                        : "Service Duration"}
                    </h3>
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-xl sm:text-2xl font-bold text-blue-700">
                      {Math.floor(deliveryTimer / 3600)
                        .toString()
                        .padStart(2, "0")}
                      :
                      {Math.floor((deliveryTimer % 3600) / 60)
                        .toString()
                        .padStart(2, "0")}
                      :
                      {Math.floor(deliveryTimer % 60)
                        .toString()
                        .padStart(2, "0")}
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      {stop.status === "ON_THE_WAY"
                        ? "Time since starting delivery"
                        : stop.status === "ARRIVED"
                        ? "Time from start to arrival"
                        : "Time at customer location"}
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamps - Mobile Optimized */}
              <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-4">
                <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    Arrival Time
                  </span>
                  <p className="font-medium text-gray-900 mt-1 text-sm sm:text-base truncate">
                    {formatDate(stop.arrivalTime)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
                  <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                    Completion Time
                  </span>
                  <p className="font-medium text-gray-900 mt-1 text-sm sm:text-base truncate">
                    {formatDate(stop.completionTime)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Returns - Enhanced with ReturnManagement Component */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                Product Returns
              </h2>
            </div>
            <div className="p-4 sm:p-5">
              {(stop.status === "ARRIVED" || stop.status === "COMPLETED") &&
              token ? (
                <ReturnManagement
                  stopId={stop.id}
                  routeId={stop.route.id}
                  customerId={stop.customer.id}
                  token={token}
                />
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
                  Returns can only be processed after arriving at the delivery
                  location.
                </div>
              )}
            </div>
          </div>

          {/* Driver Notes */}
          <DriverNotes
            stopId={stop.id}
            initialNotes={driverNotes}
            onSave={handleSaveDriverNotes}
          />

          {/* Enhanced Invoice Photo Upload - Multiple images with preview */}
          {(stop.status === "ARRIVED" || stop.status === "COMPLETED") && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">
                  Invoice Upload & Completion
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload multiple invoice images, preview them, and generate the delivery PDF
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <EnhancedInvoiceUpload
                  stopId={stop.id}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadComplete={() => {
                    // PDF generated successfully - driver can now manually complete delivery
                    console.log("PDF generated successfully");
                  }}
                />
              </div>
            </div>
          )}

          {/* Manual Completion Button - Only show if PDF has been generated */}
          {stop.signedInvoicePdfUrl && stop.status === "ARRIVED" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-medium text-green-800">
                    ✅ Ready to Complete Delivery
                  </h3>
                  <p className="text-sm text-green-600 mt-1">
                    Invoice PDF has been generated. You can now mark this delivery as completed.
                  </p>
                </div>
                <button
                  onClick={() => updateStatus("COMPLETED")}
                  disabled={updatingStatus}
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-medium py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center touch-manipulation"
                >
                  {updatingStatus ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Completing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Complete Delivery
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Stop not found. It may have been deleted or you may not have
          permission to view it.
        </div>
      )}

      {/* Payment Recording Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Record Payment Received
                </h3>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentError("");
                    setPaymentAmount("");
                    setSelectedPaymentMethods([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Payment Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Payment Methods */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Methods * (Select all that apply)
                  </label>
                  <div className="space-y-2">
                    {["Cash", "Check", "Credit Card"].map((method) => (
                      <label key={method} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedPaymentMethods.includes(method)}
                          onChange={() => togglePaymentMethod(method)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {paymentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {paymentError}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentError("");
                      setPaymentAmount("");
                      setSelectedPaymentMethods([]);
                    }}
                    disabled={savingPayment}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePayment}
                    disabled={savingPayment || !paymentAmount || selectedPaymentMethods.length === 0}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center"
                  >
                    {savingPayment ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      "Save Payment"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
