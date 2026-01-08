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
import DriverNotes from "@/components/driver/DriverNotes";
import EnhancedInvoiceUpload from "@/components/driver/EnhancedInvoiceUpload";
import ReturnManagement from "@/components/driver/ReturnManagement";
import { getPSTDate } from "@/lib/timezone";
import StopHeader from "@/components/driver/stops/StopHeader";
import CustomerInfoCard from "@/components/driver/stops/CustomerInfoCard";
import StatusUpdateCard from "@/components/driver/stops/StatusUpdateCard";
import PaymentModal from "@/components/driver/stops/PaymentModal";
import LocationTracker from "@/components/driver/LocationTracker";

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
  paymentTerms?: string | null;
  deliveryInstructions?: string | null;
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
  creditMemoNumber?: string | null;
  creditMemoAmount?: number | null;
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
  // Stop-specific payment terms
  paymentTerms?: string | null;
  paymentTermsOther?: string | null;
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
  const [paymentEntries, setPaymentEntries] = useState<Array<{ amount: string, method: string, notes: string }>>([{ amount: "", method: "", notes: "" }]);
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

      // Set arrival time if status is ARRIVED (using PST timezone)
      if (newStatus === "ARRIVED" && !stop.arrivalTime) {
        updateData.arrivalTime = getPSTDate().toISOString();
      }

      // Set completion time if status is COMPLETED (using PST timezone)
      if (newStatus === "COMPLETED" && !stop.completionTime) {
        updateData.completionTime = getPSTDate().toISOString();
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

      const responseData = await response.json();

      // If status is COMPLETED, redirect to next stop or stops page after a short delay
      if (newStatus === "COMPLETED") {
        console.log("Delivery completed successfully");
        setTimeout(() => {
          if (responseData.nextStopId) {
            console.log(`Redirecting to next stop: ${responseData.nextStopId}`);
            router.push(`/driver/stops/${responseData.nextStopId}`);
          } else {
            console.log("No next stop found, redirecting to stops list");
            router.push("/driver/stops");
          }
        }, 1500);
      } else {
        // Refresh stop details for other status updates
        fetchStopDetails();
      }
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
      setPaymentEntries([{ amount: "", method: "", notes: "" }]);
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
    setPaymentEntries(prev => [...prev, { amount: "", method: "", notes: "" }]);
  };

  const removePaymentEntry = (index: number) => {
    if (paymentEntries.length > 1) {
      setPaymentEntries(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updatePaymentEntry = (index: number, field: string, value: string) => {
    setPaymentEntries(prev => prev.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
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

  // Function to get proper document type label
  const getDocumentTypeLabel = (type: string) => {
    const documentTypes = [
      { value: "INVOICE", label: "Invoice" },
      { value: "CREDIT_MEMO", label: "Credit Memo" },
      { value: "DELIVERY_RECEIPT", label: "Statement" },
      { value: "RETURN_FORM", label: "Return Form" },
      { value: "OTHER", label: "Other" },
    ];
    const docType = documentTypes.find(dt => dt.value === type);
    return docType ? docType.label : type.replace('_', ' ');
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
              className={`flex flex-col items-center p-2 sm:p-3 rounded-lg transition-all duration-200 min-w-0 flex-1 max-w-[80px] sm:max-w-none ${currentStep === step.id
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
      <StopHeader stop={stop} />

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
          <CustomerInfoCard stop={stop} formatDate={formatDate} />

          {/* Location Tracker - Only active when driver is on the way */}
          <LocationTracker
            stopId={stop.id}
            routeId={stop.route.id}
            isActive={stop.status === "ON_THE_WAY" || stop.status === "ARRIVED"}
          />

          {/* Status Update - Mobile Optimized */}
          <StatusUpdateCard
            stop={stop}
            updatingStatus={updatingStatus}
            deliveryTimer={deliveryTimer}
            isStatusButtonDisabled={isStatusButtonDisabled}
            updateStatus={updateStatus}
            formatDate={formatDate}
          />

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
                                  <div key={doc.id} className="document-card-safe bg-blue-50 border-blue-200">
                                    <div className="document-icon text-2xl">
                                      {doc.type === 'INVOICE' ? '📄' :
                                        doc.type === 'CREDIT_MEMO' ? '💳' :
                                          doc.type === 'DELIVERY_RECEIPT' ? '📋' :
                                            doc.type === 'RETURN_FORM' ? '↩️' : '📎'}
                                    </div>
                                    <div className="document-info">
                                      <h4 className="document-title text-gray-900">
                                        {doc.title}
                                      </h4>
                                      <p className="document-meta text-gray-600">
                                        {getDocumentTypeLabel(doc.type)} • {(doc.fileSize / 1024).toFixed(1)} KB
                                      </p>
                                      {doc.description && (
                                        <p className="document-meta text-gray-500 mt-1">
                                          {doc.description}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-1 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-overflow-safe">Uploaded {formatDate(doc.createdAt)}</span>
                                      </p>
                                    </div>
                                    <div className="document-actions">
                                      <a
                                        href={doc.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors touch-manipulation mobile-button-safe"
                                      >
                                        View & Print
                                      </a>
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
                                  <div key={stopDoc.id} className="document-card-safe bg-green-50 border-green-200">
                                    <div className="document-icon text-2xl">
                                      {stopDoc.document.type === 'INVOICE' ? '📄' :
                                        stopDoc.document.type === 'CREDIT_MEMO' ? '💳' :
                                          stopDoc.document.type === 'DELIVERY_RECEIPT' ? '📋' :
                                            stopDoc.document.type === 'RETURN_FORM' ? '↩️' : '📎'}
                                    </div>
                                    <div className="document-info">
                                      <h4 className="document-title text-gray-900">
                                        {stopDoc.document.title}
                                      </h4>
                                      <p className="document-meta text-gray-600">
                                        {getDocumentTypeLabel(stopDoc.document.type)} • {(stopDoc.document.fileSize / 1024).toFixed(1)} KB
                                      </p>
                                      {stopDoc.document.description && (
                                        <p className="document-meta text-gray-500 mt-1">
                                          {stopDoc.document.description}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-500 mt-1 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-overflow-safe">Uploaded {formatDate(stopDoc.document.createdAt)}</span>
                                      </p>
                                      {stopDoc.isPrinted && (
                                        <p className="text-xs text-green-600 mt-1 flex items-center">
                                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                          <span className="text-overflow-safe">Printed {stopDoc.printedAt ? new Date(stopDoc.printedAt).toLocaleDateString() : ''}</span>
                                        </p>
                                      )}
                                    </div>
                                    <div className="document-actions">
                                      <a
                                        href={stopDoc.document.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors touch-manipulation mobile-button-safe"
                                      >
                                        View & Print
                                      </a>
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
                        token={token!}
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
                                {stop.payments.map((payment) => (
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
                                setPaymentEntries([{ amount: "", method: "", notes: "" }]);
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
                    {currentStep === steps.length ? (
                      <button
                        onClick={() => updateStatus("COMPLETED")}
                        disabled={isStatusButtonDisabled("COMPLETED")}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                          "Complete Delivery"
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={nextStep}
                        disabled={currentStep === steps.length}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next Step
                      </button>
                    )}
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
      <PaymentModal
        show={showPaymentModal}
        stop={stop}
        paymentEntries={paymentEntries}
        paymentError={paymentError}
        savingPayment={savingPayment}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentError("");
          setPaymentEntries([{ amount: "", method: "", notes: "" }]);
        }}
        addPaymentEntry={addPaymentEntry}
        removePaymentEntry={removePaymentEntry}
        updatePaymentEntry={updatePaymentEntry}
        handleSavePayment={handleSavePayment}
        setPaymentError={setPaymentError}
        setPaymentEntries={setPaymentEntries}
      />
    </div>
  );
}
