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

interface Document {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface StopDocument {
  id: string;
  document: Document;
  isPrinted: boolean;
  printedAt: string | null;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
  documents?: Document[];
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  notes?: string;
  createdAt: string;
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
  payments?: Payment[];
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
  stopDocuments?: StopDocument[];
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
  const [paymentEntries, setPaymentEntries] = useState<Array<{amount: string, method: string, notes: string}>>([{amount: "", method: "", notes: ""}]);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const steps = [
    { id: 1, title: "Document Printing", icon: "📄" },
    { id: 2, title: "Returns", icon: "📦" },
    { id: 3, title: "Payment", icon: "💰" },
    { id: 4, title: "Driver Notes", icon: "📝" },
    { id: 5, title: "Image Upload", icon: "📸" },
  ];

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

      // Auto-complete steps based on existing data
      const autoCompletedSteps: number[] = [];

      // Step 3: Payment - if driver has recorded payments
      if (data.driverPaymentAmount && data.driverPaymentAmount > 0) {
        autoCompletedSteps.push(3);
      }

      // Step 4: Driver Notes - if driver has saved notes
      if (data.driverNotes && data.driverNotes.trim() !== "") {
        autoCompletedSteps.push(4);
      }

      // Step 5: Image Upload - if PDF has been generated
      if (data.signedInvoicePdfUrl) {
        autoCompletedSteps.push(5);
      }

      // Update completed steps without duplicates
      setCompletedSteps(prev => {
        const combined = [...prev, ...autoCompletedSteps];
        return [...new Set(combined)]; // Remove duplicates
      });
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

      // Automatically mark Step 4 (Driver Notes) as completed when notes are saved
      if (!completedSteps.includes(4)) {
        setCompletedSteps(prev => [...prev, 4]);
        console.log("Step 4 (Driver Notes) automatically marked as completed");
        autoAdvanceStep(4);
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

    // Automatically mark Step 5 (Image Upload) as completed
    if (!completedSteps.includes(5)) {
      setCompletedSteps(prev => [...prev, 5]);
      console.log("Step 5 (Image Upload) automatically marked as completed");
      autoAdvanceStep(5);
    }

    fetchStopDetails();
  };

  // Handle payment recording
  const handleSavePayment = async () => {
    if (!token || !stop) return;

    // Validate payment entries
    const validPayments = paymentEntries.filter(entry =>
      entry.amount && parseFloat(entry.amount) > 0 && entry.method
    );

    if (validPayments.length === 0) {
      setPaymentError("Please enter at least one valid payment with amount and method");
      return;
    }

    setSavingPayment(true);
    setPaymentError("");

    try {
      // Convert to the format expected by the API
      const payments = validPayments.map(entry => ({
        amount: parseFloat(entry.amount),
        method: entry.method,
        notes: entry.notes || null,
      }));

      const response = await fetch(`/api/driver/stops/${unwrappedParams.id}/payment`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          payments: payments,
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
      setPaymentEntries([{amount: "", method: "", notes: ""}]);
      setShowPaymentModal(false);

      // Automatically mark Step 3 (Payment) as completed when payment is saved
      if (!completedSteps.includes(3)) {
        setCompletedSteps(prev => [...prev, 3]);
        console.log("Step 3 (Payment) automatically marked as completed");
        autoAdvanceStep(3);
      }

      // Refresh stop details
      fetchStopDetails();
    } catch (err) {
      console.error("Error saving payment:", err);
      setPaymentError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSavingPayment(false);
    }
  };

  // Payment entry management
  const addPaymentEntry = () => {
    setPaymentEntries(prev => [...prev, {amount: "", method: "", notes: ""}]);
  };

  const removePaymentEntry = (index: number) => {
    if (paymentEntries.length > 1) {
      setPaymentEntries(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updatePaymentEntry = (index: number, field: string, value: string) => {
    setPaymentEntries(prev => prev.map((entry, i) =>
      i === index ? {...entry, [field]: value} : entry
    ));
  };

  // Multi-step navigation functions
  const nextStep = () => {
    if (currentStep < steps.length) {
      // Mark current step as completed if not already
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepId: number) => {
    setCurrentStep(stepId);
  };

  const isStepCompleted = (stepId: number) => {
    return completedSteps.includes(stepId);
  };

  const canAccessStep = (stepId: number) => {
    // Can access current step, completed steps, or next step after completed ones
    return stepId <= currentStep || isStepCompleted(stepId);
  };

  // Auto-advance to next step when current step is completed
  const autoAdvanceStep = (completedStepId: number) => {
    if (completedStepId === currentStep && currentStep < steps.length) {
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
      }, 1000); // Small delay to show completion
    }
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

  // Multi-step progress indicator component
  const StepProgressIndicator = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="p-4 sm:p-5 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">
          Delivery Process
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Complete each step to finish the delivery
        </p>
      </div>
      <div className="p-4 sm:p-5">
        {/* Progress Bar */}
        <div className="relative mb-6">
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
            <div
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
              style={{ width: `${(completedSteps.length / steps.length) * 100}%` }}
            ></div>
          </div>
          <div className="text-center text-sm text-gray-600">
            {completedSteps.length} of {steps.length} steps completed
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => canAccessStep(step.id) && goToStep(step.id)}
              disabled={!canAccessStep(step.id)}
              className={`flex flex-col items-center p-2 sm:p-3 rounded-lg transition-all duration-200 min-w-0 flex-1 max-w-[80px] sm:max-w-none ${
                currentStep === step.id
                  ? "bg-blue-100 border-2 border-blue-500 text-blue-700"
                  : isStepCompleted(step.id)
                  ? "bg-green-100 border-2 border-green-500 text-green-700"
                  : canAccessStep(step.id)
                  ? "bg-gray-50 border-2 border-gray-300 text-gray-600 hover:bg-gray-100"
                  : "bg-gray-50 border-2 border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              <div className="text-lg sm:text-xl mb-1">
                {isStepCompleted(step.id) ? "✅" : step.icon}
              </div>
              <span className="text-xs font-medium text-center leading-tight">
                {step.title}
              </span>
            </button>
          ))}
        </div>

        {/* Current Step Title */}
        <div className="mt-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Step {currentStep}: {steps[currentStep - 1]?.title}
          </h3>
        </div>
      </div>
    </div>
  );

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

          {/* Multi-Step Delivery Process */}
          {(stop.status === "ARRIVED" || stop.status === "COMPLETED") && (
            <>
              <StepProgressIndicator />

              {/* Step Content */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 sm:p-5">
                  {currentStep === 1 && (
                    /* Step 1: Document Printing */
                    <div>
                      {((stop.customer.documents && stop.customer.documents.length > 0) ||
                        (stop.stopDocuments && stop.stopDocuments.length > 0)) ? (
                        <div className="space-y-4">
                          {/* Customer-Level Documents */}
                          {stop.customer.documents && stop.customer.documents.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                </svg>
                                Customer Documents
                              </h3>
                              <div className="grid gap-3">
                                {stop.customer.documents.map((doc) => (
                                  <div key={doc.id} className="border border-blue-200 rounded-lg p-3 bg-blue-50">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3 flex-1">
                                        <div className="text-2xl">
                                          {doc.type === 'INVOICE' ? '📄' :
                                           doc.type === 'CREDIT_MEMO' ? '💳' :
                                           doc.type === 'DELIVERY_RECEIPT' ? '📋' :
                                           doc.type === 'RETURN_FORM' ? '↩️' : '📎'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="text-sm font-medium text-gray-900 truncate">
                                            {doc.title}
                                          </h4>
                                          <p className="text-xs text-gray-600">
                                            {doc.type.replace('_', ' ')} • {(doc.fileSize / 1024).toFixed(1)} KB
                                          </p>
                                          {doc.description && (
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                              {doc.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <a
                                          href={doc.filePath}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors touch-manipulation"
                                        >
                                          View & Print
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Stop-Specific Documents */}
                          {stop.stopDocuments && stop.stopDocuments.length > 0 && (
                            <div>
                              <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                </svg>
                                Stop-Specific Documents
                              </h3>
                              <div className="grid gap-3">
                                {stop.stopDocuments.map((stopDoc) => (
                                  <div key={stopDoc.id} className="border border-green-200 rounded-lg p-3 bg-green-50">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3 flex-1">
                                        <div className="text-2xl">
                                          {stopDoc.document.type === 'INVOICE' ? '📄' :
                                           stopDoc.document.type === 'CREDIT_MEMO' ? '💳' :
                                           stopDoc.document.type === 'DELIVERY_RECEIPT' ? '📋' :
                                           stopDoc.document.type === 'RETURN_FORM' ? '↩️' : '📎'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h4 className="text-sm font-medium text-gray-900 truncate">
                                            {stopDoc.document.title}
                                          </h4>
                                          <p className="text-xs text-gray-600">
                                            {stopDoc.document.type.replace('_', ' ')} • {(stopDoc.document.fileSize / 1024).toFixed(1)} KB
                                          </p>
                                          {stopDoc.document.description && (
                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                              {stopDoc.document.description}
                                            </p>
                                          )}
                                          {stopDoc.isPrinted && (
                                            <p className="text-xs text-green-600 mt-1 flex items-center">
                                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                              </svg>
                                              Printed {stopDoc.printedAt ? new Date(stopDoc.printedAt).toLocaleDateString() : ''}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <a
                                          href={stopDoc.document.filePath}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors touch-manipulation"
                                        >
                                          View & Print
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p>No documents to print for this delivery</p>
                        </div>
                      )}
                    </div>
                  )}

                  {currentStep === 2 && (
                    /* Step 2: Returns */
                    <div>
                      <ReturnManagement
                        stopId={stop.id}
                        routeId={stop.route.id}
                        customerId={stop.customer.id}
                        token={token}
                      />
                    </div>
                  )}

                  {currentStep === 3 && (
                    /* Step 3: Payment */
                    <div>
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <h4 className="text-lg font-medium text-gray-700 mb-2">Payment Information</h4>
                            {stop.payments && stop.payments.length > 0 ? (
                              <div className="space-y-2">
                                {stop.payments.map((payment, index) => (
                                  <div key={payment.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-green-600">
                                        ${payment.amount.toFixed(2)} - {payment.method}
                                      </div>
                                      {payment.notes && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          {payment.notes}
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-400">
                                        {formatDate(payment.createdAt)}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                <div className="text-lg font-bold text-green-600 pt-2 border-t border-gray-200">
                                  Total: ${stop.driverPaymentAmount?.toFixed(2) || "0.00"}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                No payments recorded yet
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              // Pre-populate form with existing payment data when updating
                              if (stop.payments && stop.payments.length > 0) {
                                const existingPayments = stop.payments.map(payment => ({
                                  amount: payment.amount.toString(),
                                  method: payment.method,
                                  notes: payment.notes || ""
                                }));
                                setPaymentEntries(existingPayments);
                              } else {
                                setPaymentEntries([{amount: "", method: "", notes: ""}]);
                              }
                              setShowPaymentModal(true);
                            }}
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
                  )}

                  {currentStep === 4 && (
                    /* Step 4: Driver Notes */
                    <div>
                      <DriverNotes
                        stopId={stop.id}
                        initialNotes={driverNotes}
                        onSave={handleSaveDriverNotes}
                      />
                    </div>
                  )}

                  {currentStep === 5 && (
                    /* Step 5: Image Upload */
                    <div>
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 mb-2">
                            Invoice Upload & Completion
                          </h3>
                          <p className="text-sm text-gray-600">
                            Upload multiple invoice images, preview them, and generate the delivery PDF
                          </p>
                        </div>
                        <EnhancedInvoiceUpload
                          stopId={stop.id}
                          onUploadSuccess={handleUploadSuccess}
                          onUploadComplete={() => {
                            // PDF generated successfully - automatically mark step as completed
                            console.log("PDF generated successfully");

                            // Automatically mark Step 5 (Image Upload) as completed
                            if (!completedSteps.includes(5)) {
                              setCompletedSteps(prev => [...prev, 5]);
                              console.log("Step 5 (Image Upload) automatically marked as completed via onUploadComplete");
                              autoAdvanceStep(5);
                            }
                          }}
                        />

                        {/* Manual Completion Button - Only show if PDF has been generated */}
                        {stop.signedInvoicePdfUrl && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
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
                    </div>
                  )}

                  {/* Step Navigation */}
                  <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={prevStep}
                      disabled={currentStep === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={nextStep}
                      disabled={currentStep === steps.length}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Step
                    </button>
                  </div>
                </div>
              </div>
            </>
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
                  {stop && stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? "Update Payment" : "Record Payment Received"}
                </h3>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPaymentError("");
                    setPaymentEntries([{amount: "", method: "", notes: ""}]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">Payment Entries</h4>
                  <button
                    type="button"
                    onClick={addPaymentEntry}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Add Another Payment
                  </button>
                </div>

                {paymentEntries.map((entry, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Payment {index + 1}
                      </span>
                      {paymentEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePaymentEntry(index)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={entry.amount}
                          onChange={(e) => updatePaymentEntry(index, 'amount', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Method
                        </label>
                        <select
                          value={entry.method}
                          onChange={(e) => updatePaymentEntry(index, 'method', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select method</option>
                          <option value="Cash">Cash</option>
                          <option value="Check">Check</option>
                          <option value="Credit Card">Credit Card</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) => updatePaymentEntry(index, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Check number, reference, etc."
                      />
                    </div>
                  </div>
                ))}

                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-700">
                    Total Amount: $
                    {paymentEntries
                      .filter(entry => entry.amount && parseFloat(entry.amount) > 0)
                      .reduce((sum, entry) => sum + parseFloat(entry.amount), 0)
                      .toFixed(2)
                    }
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
                      setPaymentEntries([{amount: "", method: "", notes: ""}]);
                    }}
                    disabled={savingPayment}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePayment}
                    disabled={savingPayment || paymentEntries.filter(entry => entry.amount && parseFloat(entry.amount) > 0 && entry.method).length === 0}
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
