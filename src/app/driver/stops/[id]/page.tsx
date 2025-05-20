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
import { ReturnData } from "@/components/driver/ReturnForm";

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
  const [savingNotes, setSavingNotes] = useState(false);
  const [hasReturns, setHasReturns] = useState(false);
  const [returns, setReturns] = useState<
    Array<{
      id: string;
      orderItemIdentifier: string;
      productDescription: string | null;
      quantity: number;
      reasonCode: string;
    }>
  >([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [addingReturn, setAddingReturn] = useState(false);
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [hasNewAdminNotes, setHasNewAdminNotes] = useState(false);

  // Return form state
  const [returnItem, setReturnItem] = useState("");
  const [returnDescription, setReturnDescription] = useState("");
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState("");
  const [products, setProducts] = useState<
    Array<{ id: string; name: string; sku: string; unit: string }>
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [deliveryTimer, setDeliveryTimer] = useState<number | null>(null);

  const router = useRouter();

  // Initialize socket connection
  const { isConnected, joinRoom, socketError, reconnect } = useSocket();

  // Fetch returns for this stop - wrapped in useCallback
  const fetchReturns = useCallback(async () => {
    if (!token) return;

    setLoadingReturns(true);

    try {
      const response = await fetch(
        `/api/driver/stops/${unwrappedParams.id}/returns`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          // Add cache: 'no-store' to prevent caching
          cache: "no-store",
        }
      );

      if (!response.ok) {
        // Handle non-JSON responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch returns");
        } else {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
        }
      }

      const data = await response.json();
      setReturns(data);
      setHasReturns(data.length > 0);
    } catch (err) {
      console.error("Error fetching returns:", err);
    } finally {
      setLoadingReturns(false);
    }
  }, [token, unwrappedParams.id]);

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

      // After fetching stop details, fetch returns
      fetchReturns();
    } catch (err) {
      console.error("Error fetching stop details:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [token, unwrappedParams.id, fetchReturns]);

  // Fetch products for returns - wrapped in useCallback
  const fetchProducts = useCallback(async () => {
    if (!token) return;

    setLoadingProducts(true);

    try {
      // This would be a real API endpoint in production
      // For now, we'll use mock data
      // const response = await fetch('/api/products', {
      //   headers: {
      //     Authorization: `Bearer ${token}`,
      //   },
      // });

      // if (!response.ok) {
      //   throw new Error('Failed to fetch products');
      // }

      // const data = await response.json();
      // setProducts(data);

      // Mock data for now
      setTimeout(() => {
        setProducts([
          { id: "P001", name: "Bread - White", sku: "BRD-W-001", unit: "loaf" },
          { id: "P002", name: "Bread - Wheat", sku: "BRD-W-002", unit: "loaf" },
          { id: "P003", name: "Milk - 2%", sku: "MLK-2-001", unit: "gallon" },
          { id: "P004", name: "Eggs - Large", sku: "EGG-L-001", unit: "dozen" },
          {
            id: "P005",
            name: "Butter - Unsalted",
            sku: "BTR-U-001",
            unit: "pound",
          },
          {
            id: "P006",
            name: "Cheese - Cheddar",
            sku: "CHS-C-001",
            unit: "pound",
          },
          {
            id: "P007",
            name: "Apples - Red Delicious",
            sku: "APL-R-001",
            unit: "pound",
          },
          { id: "P008", name: "Bananas", sku: "BNN-Y-001", unit: "bunch" },
          {
            id: "P009",
            name: "Potatoes - Russet",
            sku: "POT-R-001",
            unit: "pound",
          },
          {
            id: "P010",
            name: "Onions - Yellow",
            sku: "ONI-Y-001",
            unit: "pound",
          },
        ]);
        setLoadingProducts(false);
      }, 500);
    } catch (err) {
      console.error("Error fetching products:", err);
      setLoadingProducts(false);
    }
  }, [token]);

  // Add a new return
  const handleAddReturn = async (returnData: ReturnData) => {
    if (!token) return;

    setAddingReturn(true);

    try {
      const response = await fetch(
        `/api/driver/stops/${unwrappedParams.id}/returns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(returnData),
        }
      );

      if (!response.ok) {
        // Handle non-JSON responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to add return");
        } else {
          throw new Error(
            `Server error: ${response.status} ${response.statusText}`
          );
        }
      }

      // Refresh returns list
      fetchReturns();

      // Reset form fields
      setReturnItem("");
      setReturnDescription("");
      setReturnQuantity(1);
      setReturnReason("");
    } catch (err) {
      console.error("Error adding return:", err);
      throw err;
    } finally {
      setAddingReturn(false);
    }
  };

  // Form submission handler for returns
  const addReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!returnItem || !returnReason) {
      return;
    }

    try {
      await handleAddReturn({
        orderItemIdentifier: returnItem,
        productDescription: returnDescription,
        quantity: returnQuantity,
        reasonCode: returnReason,
        warehouseLocation: "",
        vendorCreditNum: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add return");
    }
  };

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
      fetchProducts();
    }
  }, [token, fetchStopDetails, fetchProducts]);

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
    stop?.adminNotes || [],
    (newNote) => {
      console.log(
        `[OptimizedSocket] Received new admin note without full refetch: "${newNote.note}"`
      );
      // Show notification
      setHasNewAdminNotes(true);
      setNotificationVisible(true);

      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotificationVisible(false);
      }, 5000);

      // Update the admin notes in the local state without a full refetch
      if (stop) {
        console.log(
          `[OptimizedSocket] Updating admin notes for stop ${stop.id}`
        );
        setStop({
          ...stop,
          adminNotes: [newNote, ...(stop.adminNotes || [])],
        });
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

    setSavingNotes(true);
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
    } finally {
      setSavingNotes(false);
    }
  };

  // Handle successful invoice upload
  const handleUploadSuccess = (pdfUrl: string) => {
    // Refresh stop details to get the updated invoice URL and status
    console.log(`Invoice uploaded successfully: ${pdfUrl}`);
    fetchStopDetails();
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
    <div className="max-w-2xl mx-auto pb-24 px-4 sm:px-6">
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
            className="flex items-center text-gray-600 hover:text-black transition-colors"
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
              </div>

              {/* Delivery Instructions - Mobile Optimized */}
              {stop.initialDriverNotes && (
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
                    <div className="ml-2 sm:ml-3">
                      <h3 className="text-sm font-medium text-blue-800">
                        Delivery Instructions
                      </h3>
                      <div className="mt-1 sm:mt-2 text-sm text-blue-700">
                        <p className="whitespace-pre-wrap break-words">
                          {stop.initialDriverNotes}
                        </p>
                      </div>
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
                    className="h-10 sm:h-12 text-sm sm:text-base"
                  />
                  <StatusButton
                    status={stop.status}
                    targetStatus="ARRIVED"
                    currentStatus="ON_THE_WAY"
                    isUpdating={updatingStatus}
                    isDisabled={isStatusButtonDisabled("ARRIVED")}
                    onClick={() => updateStatus("ARRIVED")}
                    label="Mark as Arrived"
                    className="h-10 sm:h-12 text-sm sm:text-base"
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

          {/* Returns - Mobile Optimized */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  Product Returns
                </h2>
                <div className="mt-2 sm:mt-0">
                  <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
                    <button
                      onClick={() => setHasReturns(false)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                        !hasReturns
                          ? "bg-white shadow-sm text-gray-800"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      No Returns
                    </button>
                    <button
                      onClick={() => setHasReturns(true)}
                      className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                        hasReturns
                          ? "bg-white shadow-sm text-gray-800"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Has Returns
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {hasReturns ? (
                <div className="space-y-5 sm:space-y-6">
                  {/* Return Items List - Mobile Optimized */}
                  {returns.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2 sm:mb-3">
                        Returned Items
                      </h3>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th
                                  scope="col"
                                  className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                  Item
                                </th>
                                <th
                                  scope="col"
                                  className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                  Qty
                                </th>
                                <th
                                  scope="col"
                                  className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >
                                  Reason
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {returns.map((returnItem, index) => (
                                <tr
                                  key={returnItem.id}
                                  className={
                                    index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                  }
                                >
                                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm">
                                    <div className="font-medium text-gray-900 text-xs sm:text-sm">
                                      {returnItem.orderItemIdentifier}
                                    </div>
                                    {returnItem.productDescription && (
                                      <div className="text-gray-500 mt-1 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                                        {returnItem.productDescription}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                                    {returnItem.quantity}
                                  </td>
                                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium ${
                                        returnItem.reasonCode === "DAMAGED"
                                          ? "bg-red-100 text-red-800"
                                          : returnItem.reasonCode === "EXPIRED"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : returnItem.reasonCode ===
                                            "WRONG_ITEM"
                                          ? "bg-blue-100 text-blue-800"
                                          : returnItem.reasonCode ===
                                            "CUSTOMER_REFUSED"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {returnItem.reasonCode ===
                                      "CUSTOMER_REFUSED"
                                        ? "REFUSED"
                                        : returnItem.reasonCode.replace(
                                            /_/g,
                                            " "
                                          )}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-gray-500 text-sm">
                        No return items added yet.
                      </p>
                    </div>
                  )}

                  {/* Add Return Form - Enhanced */}
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-4">
                      Add Return Item
                    </h3>
                    <form onSubmit={addReturn} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label
                            htmlFor="returnItem"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Select Product *
                          </label>
                          <div className="relative">
                            <select
                              id="returnItem"
                              value={returnItem}
                              onChange={(e) => {
                                setReturnItem(e.target.value);
                                // Find the selected product and set its description
                                const selectedProduct = products.find(
                                  (p) => p.sku === e.target.value
                                );
                                if (selectedProduct) {
                                  setReturnDescription(selectedProduct.name);
                                }
                              }}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-colors appearance-none"
                              required
                            >
                              <option value="">Select a product</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.sku}>
                                  {product.sku} - {product.name} ({product.unit}
                                  )
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                              <svg
                                className="fill-current h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                              </svg>
                            </div>
                          </div>
                          {loadingProducts && (
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Loading products...
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label
                            htmlFor="returnDescription"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Description
                          </label>
                          <input
                            id="returnDescription"
                            type="text"
                            value={returnDescription}
                            onChange={(e) =>
                              setReturnDescription(e.target.value)
                            }
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-colors"
                            placeholder="Product description"
                            readOnly
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="returnQuantity"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Quantity *
                          </label>
                          <input
                            id="returnQuantity"
                            type="number"
                            min="1"
                            value={returnQuantity}
                            onChange={(e) =>
                              setReturnQuantity(parseInt(e.target.value))
                            }
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="returnReason"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Reason *
                          </label>
                          <select
                            id="returnReason"
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-colors"
                            required
                          >
                            <option value="">Select reason</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="WRONG_ITEM">Wrong Item</option>
                            <option value="CUSTOMER_REFUSED">
                              Customer Refused
                            </option>
                            <option value="OTHER">Other</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={addingReturn || !returnItem || !returnReason}
                        className="w-full py-3 px-4 bg-black text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                      >
                        {addingReturn ? (
                          <span className="flex items-center justify-center">
                            <svg
                              className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Adding Return Item...
                          </span>
                        ) : (
                          "Add Return Item"
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
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
                  <h3 className="mt-2 text-sm font-medium text-gray-900">
                    No Product Returns
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    This delivery has no products being returned to the
                    warehouse.
                  </p>
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

          {/* Invoice Photo Upload - Opens camera but doesn't automatically mark delivery as completed */}
          <InvoiceUpload
            stopId={stop.id}
            onUploadSuccess={handleUploadSuccess}
            existingPdfUrl={stop.signedInvoicePdfUrl}
            markAsCompleted={false}
            currentStopStatus={stop.status}
          />

          {/* Admin Notes - Enhanced */}
          {stop.adminNotes && stop.adminNotes.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-yellow-500 mr-2"
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
                  <h2 className="text-lg font-bold text-gray-900">
                    Notes from Admin
                  </h2>
                  <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {stop.adminNotes.length}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-4">
                  {stop.adminNotes.map((note) => (
                    <div
                      key={note.id}
                      className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-yellow-600"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                            {note.note}
                          </p>
                          <div className="mt-3 flex justify-between items-center border-t border-yellow-200 pt-2">
                            <div className="flex items-center">
                              <svg
                                className="h-4 w-4 text-yellow-600 mr-1"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <p className="text-xs font-medium text-yellow-700">
                                {note.admin.fullName || note.admin.username}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <svg
                                className="h-4 w-4 text-yellow-600 mr-1"
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
                              <p className="text-xs text-yellow-700">
                                {new Date(note.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
    </div>
  );
}
