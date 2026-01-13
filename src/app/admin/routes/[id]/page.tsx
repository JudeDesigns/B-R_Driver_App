"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSocket } from "@/contexts/SocketContext";
import { useOptimizedRouteDetails } from "@/hooks/useOptimizedSocketEvents";
import WebSocketErrorAlert from "@/components/ui/WebSocketErrorAlert";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDateTime, getStatusBadgeClass, getPaymentMethod, getTotalAmount, getTotalPaymentAmount } from "@/utils/routeUtils";
import { useRouteDetails } from "@/hooks/useRouteDetails";
import RouteSummary from "@/components/admin/routes/RouteSummary";
import AddStopModal from "@/components/admin/routes/AddStopModal";
import DeleteRouteDialog from "@/components/admin/routes/DeleteRouteDialog";
import EmailResultsModal from "@/components/admin/routes/EmailResultsModal";

import { exportRoute, generateImageReport, generateImagePDF, sendBulkEmails, deleteRoute } from "@/services/routeOperations";
import { addStop, updateStopSequence, fetchDrivers } from "@/services/stopOperations";

interface Driver {
  id: string;
  username: string;
  fullName: string | null;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
  groupCode: string | null;
  paymentTerms: string | null;
  deliveryInstructions: string | null;
}

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string | null;
  driverNameFromUpload: string | null; // Added driver name from upload
  orderNumberWeb: string | null;
  quickbooksInvoiceNum: string | null;
  creditMemoNumber: string | null;
  creditMemoAmount: number | null;
  creditMemos?: Array<{
    id: string;
    creditMemoNumber: string;
    creditMemoAmount: number;
    createdAt: string;
  }>;
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
  // Payment amounts from Excel
  paymentAmountCash?: number;
  paymentAmountCheck?: number;
  paymentAmountCC?: number;
  totalPaymentAmount?: number;
  // Driver-recorded payment information
  driverPaymentAmount?: number;
  driverPaymentMethods?: string[];
  invoiceImageUrls?: string[];
  hasReturns?: boolean;
  // Stop-specific payment terms
  paymentTerms?: string | null;
  paymentTermsOther?: string | null;
}



export default function RouteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params object using React.use()
  const unwrappedParams = use(params);
  const routeId = unwrappedParams.id;

  // Use custom hook for route data management
  const {
    route,
    setRoute,
    loading,
    error,
    setError,
    token,
    userRole,
    setSuppressErrors,
    fetchRouteDetails
  } = useRouteDetails(routeId);

  const [groupByDriver, setGroupByDriver] = useState(true); // State to toggle grouping by driver
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteWarning, setDeleteWarning] = useState<{
    message: string;
    completedStops: number;
    totalStops: number;
  } | null>(null);

  // Email sending state
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [emailResults, setEmailResults] = useState<any>(null);
  const [showEmailResults, setShowEmailResults] = useState(false);

  // Image report generation state
  const [isGeneratingImageReport, setIsGeneratingImageReport] = useState(false);
  const [isGeneratingImagePDF, setIsGeneratingImagePDF] = useState(false);

  // Add Stop Modal State
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [addStopForm, setAddStopForm] = useState({
    customerNameFromUpload: "",
    driverId: "",
    orderNumberWeb: "",
    quickbooksInvoiceNum: "",
    initialDriverNotes: "",
    isCOD: false,
    amount: "",
    address: "",
    contactInfo: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [addingStop, setAddingStop] = useState(false);

  // Drag and Drop State
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedStop, setDraggedStop] = useState<Stop | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<string>('sequence');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Sequence editing state
  const [editingSequence, setEditingSequence] = useState<string | null>(null);
  const [tempSequence, setTempSequence] = useState<number>(0);

  // Payment terms editing state
  const [editingPaymentTerms, setEditingPaymentTerms] = useState<string | null>(null);
  const [tempPaymentTerms, setTempPaymentTerms] = useState<string>("");
  const [tempPaymentTermsOther, setTempPaymentTermsOther] = useState<string>("");
  const [savingPaymentTerms, setSavingPaymentTerms] = useState(false);

  const router = useRouter();

  // Drag and Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Initialize socket connection
  const { isConnected, joinRoom, error: socketError, reconnect } = useSocket();

  // Use the fetchRouteDetails from the hook

  useEffect(() => {
    if (token) {
      handleFetchDrivers();
    }
  }, [token]);

  // Fetch drivers for the dropdown
  const handleFetchDrivers = async () => {
    try {
      const data = await fetchDrivers();
      setDrivers(data);
    } catch (error) {
      if (error instanceof Error && error.message === "Authentication required") {
        router.push("/login");
        return;
      }
      console.error("Error fetching drivers:", error);
    }
  };

  // Use optimized route details hook for real-time updates
  const { route: optimizedRoute } = useOptimizedRouteDetails(routeId, route);

  // Update the route state when optimizedRoute changes
  useEffect(() => {
    if (optimizedRoute && optimizedRoute._lastUpdated) {
      // Use _lastUpdated timestamp to determine if this is actually a new update
      const currentLastUpdated = route?._lastUpdated;
      const newLastUpdated = optimizedRoute._lastUpdated;

      if (newLastUpdated !== currentLastUpdated) {
        console.log(
          "[AdminRouteDetails] Received optimized route update:",
          optimizedRoute._lastUpdated
        );
        setRoute(optimizedRoute);
      }
    }
  }, [optimizedRoute]); // Removed 'route' from dependencies to prevent infinite loop

  // Set up WebSocket connection for room joining only
  useEffect(() => {
    if (!isConnected || !routeId) return;

    // Join the route room
    joinRoom(`route:${routeId}`);
    console.log(`[OptimizedSocket] Joined route:${routeId} room`);

    // No need to subscribe to events here as the optimized hooks handle that
    return () => {
      // No cleanup needed for subscriptions as they're handled by the hooks
    };
  }, [isConnected, joinRoom, routeId]);

  // Sorting function
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort stops function
  const getSortedStops = (stops: Stop[]) => {
    return [...stops].sort((a, b) => {
      let aValue: any = a[sortField as keyof Stop];
      let bValue: any = b[sortField as keyof Stop];

      // Handle special cases
      if (sortField === 'customerNameFromUpload') {
        aValue = a.customerNameFromUpload || '';
        bValue = b.customerNameFromUpload || '';
      } else if (sortField === 'amount') {
        aValue = a.amount || 0;
        bValue = b.amount || 0;
      } else if (sortField === 'arrivalTime' || sortField === 'completionTime') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  // Export route data
  const handleExportRoute = async (format: 'csv' | 'json' = 'csv') => {
    if (!route) return;

    setExporting(true);
    setExportError("");

    try {
      await exportRoute(route, format);
    } catch (err) {
      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }
      setExportError(err instanceof Error ? err.message : "An error occurred during export");
    } finally {
      setExporting(false);
    }
  };

  // Generate and download route image archive
  const handleGenerateImageReport = async () => {
    if (!route) return;

    // Check if route has any images
    const totalImages = route.stops.reduce((total, stop) => total + (stop.invoiceImageUrls?.length || 0), 0);

    if (totalImages === 0) {
      alert("❌ No images found for this route. Complete some deliveries with image uploads first.");
      return;
    }

    // Confirm archive creation
    const confirmed = confirm(
      `📦 Create image archive for Route ${route.routeNumber}?\n\n` +
      `This will:\n` +
      `• Generate a ZIP file with ${totalImages} images\n` +
      `• Include an HTML report for offline viewing\n` +
      `• Schedule server cleanup in 3 days\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setIsGeneratingImageReport(true);

    try {
      await generateImageReport(route);

      // Show success message with cleanup info
      alert(
        `✅ Image archive created successfully!\n\n` +
        ` Server cleanup scheduled: 3 days from now\n` +
        `🛑 To cancel cleanup, contact system administrator\n\n` +
        `The ZIP contains:\n` +
        `• HTML report for offline viewing\n` +
        `• All ${totalImages} images in original quality\n` +
        `• README with instructions`
      );

    } catch (err) {
      console.error("📦 Error generating image archive:", err);

      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }

      let errorMessage = "Failed to generate image archive";
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setIsGeneratingImageReport(false);
    }
  };

  // Generate and download route image PDF (replaces ZIP functionality)
  const handleGenerateImagePDF = async () => {
    if (!route) return;

    // Check if route has any images
    const totalImages = route.stops.reduce((total, stop) => total + (stop.invoiceImageUrls?.length || 0), 0);

    if (totalImages === 0) {
      alert("❌ No images found for this route. Complete some deliveries with image uploads first.");
      return;
    }

    // Count drivers and stops with images
    const driversWithImages = new Set();
    const stopsWithImages = route.stops.filter(stop => stop.invoiceImageUrls?.length > 0);

    stopsWithImages.forEach(stop => {
      if (stop.driverNameFromUpload) {
        driversWithImages.add(stop.driverNameFromUpload);
      }
    });

    // Confirm PDF creation
    const confirmed = confirm(
      `📄 Generate PDF report for Route ${route.routeNumber}?\n\n` +
      `This will create a professional PDF with:\n` +
      `• ${driversWithImages.size} driver sections\n` +
      `• ${stopsWithImages.length} stops with images\n` +
      `• ${totalImages} high-quality embedded images\n` +
      `• Customer names and stop details\n\n` +
      `Continue?`
    );

    if (!confirmed) return;

    setIsGeneratingImagePDF(true);

    try {
      await generateImagePDF(route);

      // Show success message
      alert(
        `✅ PDF report generated successfully!\n\n` +
        `📄 The PDF contains:\n` +
        `• Professional business document format\n` +
        `• All ${totalImages} images in original quality\n` +
        `• Organized by driver and customer\n` +
        `• Ready for sharing and archiving`
      );
    } catch (err) {
      console.error("📄 Error generating PDF report:", err);

      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }

      let errorMessage = "Failed to generate PDF report";
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      alert(`❌ Error: ${errorMessage}`);
    } finally {
      setIsGeneratingImagePDF(false);
    }
  };

  // Function to group stops by driver
  const getStopsGroupedByDriver = () => {
    if (!route) return {};

    const grouped: Record<string, Stop[]> = {};

    route.stops.forEach((stop) => {
      const driverName = stop.driverNameFromUpload || route.driver.username;
      if (!grouped[driverName]) {
        grouped[driverName] = [];
      }
      grouped[driverName].push(stop);
    });

    // Sort stops within each driver group
    Object.keys(grouped).forEach((driverName) => {
      grouped[driverName].sort((a, b) => a.sequence - b.sequence);
    });

    return grouped;
  };

  // Send emails for all completed stops in the route
  const handleSendBulkEmails = async () => {
    if (!route) return;

    setIsSendingEmails(true);
    setEmailResults(null);
    setShowEmailResults(false);
    setError(""); // Clear any previous errors
    setSuppressErrors(true); // Suppress errors during email operation

    try {
      console.log("📧 Starting bulk email send for route:", routeId);

      const data = await sendBulkEmails(route);

      // Show success message
      const completedCount = route.stops.filter(s => s.status === 'COMPLETED').length;
      const successMessage = `✅ Bulk email sending completed! ${data.results?.sent || 0}/${completedCount} emails sent successfully.`;

      setEmailResults(data);
      setShowEmailResults(true);

      // Show success alert
      alert(successMessage);

      console.log("📧 Bulk email results:", data);

    } catch (err) {
      console.error("📧 Error sending bulk emails:", err);

      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }

      // More detailed error message
      let errorMessage = "Failed to send emails";
      if (err instanceof Error) {
        if (err.message.includes("JSON")) {
          errorMessage = "Server response error. Emails may have been sent - check your office email and server logs.";
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);

      // Show error alert
      alert(`❌ Error: ${errorMessage}`);

    } finally {
      setIsSendingEmails(false);
      // Re-enable error display after a short delay
      setTimeout(() => setSuppressErrors(false), 2000);
    }
  };

  // Delete route functions
  const handleDeleteRoute = async () => {
    if (!route) return;

    setDeleteLoading(true);
    setDeleteError("");
    setDeleteWarning(null);

    try {
      const data = await deleteRoute(route.id, false);

      // Success - route deleted
      console.log("Route deleted successfully:", data);

      // Dispatch event to refresh sidebar
      window.dispatchEvent(new CustomEvent('routeUpdated', {
        detail: {
          routeId: route.id,
          action: 'deleted'
        }
      }));

      // Redirect to routes list
      router.push("/admin/routes");
    } catch (err) {
      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }

      // Check if it's a 409 conflict (completed stops warning)
      if (err instanceof Error && err.message.includes("completed stops")) {
        // Parse the error to extract warning details
        setDeleteWarning({
          message: err.message,
          completedStops: 0, // Would need to be extracted from error
          totalStops: route.stops.length,
        });
        setDeleteLoading(false);
        return;
      }

      setDeleteError(err instanceof Error ? err.message : "An error occurred");
      setDeleteLoading(false);
    }
  };

  const handleForceDelete = async () => {
    if (!route) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      const data = await deleteRoute(route.id, true);

      // Success - route deleted
      console.log("Route force deleted successfully:", data);

      // Dispatch event to refresh sidebar
      window.dispatchEvent(new CustomEvent('routeUpdated', {
        detail: {
          routeId: route.id,
          action: 'deleted'
        }
      }));

      // Redirect to routes list
      router.push("/admin/routes");
    } catch (err) {
      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }

      setDeleteError(err instanceof Error ? err.message : "An error occurred");
      setDeleteLoading(false);
    }
  };

  const resetDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteError("");
    setDeleteWarning(null);
    setDeleteLoading(false);
  };

  // Function to update stop sequence
  const handleUpdateStopSequence = async (stopId: string, newSequence: number) => {
    try {
      await updateStopSequence(routeId, stopId, newSequence);

      // Refresh the route data
      fetchRouteDetails();
      setEditingSequence(null);
    } catch (err) {
      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }
      console.error("Error updating sequence:", err);
      alert("Failed to update sequence. Please try again.");
    }
  };

  // Handle sequence edit start
  const startEditingSequence = (stopId: string, currentSequence: number) => {
    setEditingSequence(stopId);
    setTempSequence(currentSequence);
  };

  // Handle sequence edit save
  const saveSequence = (stopId: string) => {
    if (tempSequence > 0) {
      handleUpdateStopSequence(stopId, tempSequence);
    }
  };

  // Handle sequence edit cancel
  const cancelEditingSequence = () => {
    setEditingSequence(null);
    setTempSequence(0);
  };

  // Payment Terms Editing Functions
  const startEditingPaymentTerms = (stop: Stop) => {
    setEditingPaymentTerms(stop.id);
    // Use the stored text value, falling back to customer terms or "COD"
    // If "Other" was used previously, try to use the 'paymentTermsOther' value, effectively migrating it to the main field for display
    let initialValue = stop.paymentTerms || stop.customer?.paymentTerms || "COD";
    if (initialValue === "Other" && stop.paymentTermsOther) {
      initialValue = stop.paymentTermsOther;
    }
    setTempPaymentTerms(initialValue);
    setTempPaymentTermsOther(""); // No longer needed
  };

  const cancelEditingPaymentTerms = () => {
    setEditingPaymentTerms(null);
    setTempPaymentTerms("");
    setTempPaymentTermsOther("");
  };

  const savePaymentTerms = async (stopId: string) => {
    if (!token) return;

    setSavingPaymentTerms(true);
    try {
      const response = await fetch(`/api/admin/stops/${stopId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentTerms: tempPaymentTerms,
          paymentTermsOther: null, // Clear 'Other' field as we are moving to free text
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update payment terms");
      }

      // Refresh route details
      await fetchRouteDetails();
      setEditingPaymentTerms(null);
      setTempPaymentTerms("");
      setTempPaymentTermsOther("");
    } catch (err) {
      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }
      console.error("Error updating payment terms:", err);
      alert("Failed to update payment terms. Please try again.");
    } finally {
      setSavingPaymentTerms(false);
    }
  };

  // Add Stop Functions
  const handleCustomerSelect = (customerName: string, customer?: any) => {
    setAddStopForm(prev => ({
      ...prev,
      customerNameFromUpload: customerName,
      // Auto-fill address and contact info if customer is selected
      address: customer?.address || prev.address,
      contactInfo: customer?.phone || customer?.email || prev.contactInfo,
    }));
    setSelectedCustomer(customer);
  };

  const handleCloseAddStopModal = () => {
    setAddStopForm({
      customerNameFromUpload: "",
      driverId: "",
      orderNumberWeb: "",
      quickbooksInvoiceNum: "",
      initialDriverNotes: "",
      isCOD: false,
      amount: "",
      address: "",
      contactInfo: "",
    });
    setSelectedCustomer(null);
    setShowAddStopModal(false);
    setError("");
  };

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStopForm.customerNameFromUpload || !addStopForm.driverId) {
      setError("Customer name and driver are required");
      return;
    }

    setAddingStop(true);
    setError("");

    try {
      await addStop(routeId, addStopForm);

      // Reset form and close modal
      setAddStopForm({
        customerNameFromUpload: "",
        driverId: "",
        orderNumberWeb: "",
        quickbooksInvoiceNum: "",
        initialDriverNotes: "",
        isCOD: false,
        amount: "",
        address: "",
        contactInfo: "",
      });
      setSelectedCustomer(null);
      setShowAddStopModal(false);

      // Refresh route details
      await fetchRouteDetails();
    } catch (err) {
      if (err instanceof Error && err.message === "Authentication required") {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setAddingStop(false);
    }
  };

  // Drag and Drop Functions
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    // Find the dragged stop
    const stop = route?.stops.find(s => s.id === active.id);
    setDraggedStop(stop || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setDraggedStop(null);

    if (!over || !route) return;

    const activeStopId = active.id as string;
    const overDriverName = over.id as string;

    // Find the stop being dragged
    const activeStop = route.stops.find(stop => stop.id === activeStopId);
    if (!activeStop) return;

    // Check if we're dropping on a different driver
    const currentDriverName = activeStop.driverNameFromUpload || route.driver.username;
    if (currentDriverName === overDriverName) return;

    // Find the driver ID for the target driver
    const targetDriver = drivers.find(d =>
      (d.fullName || d.username) === overDriverName
    );

    if (!targetDriver) return;

    try {
      const response = await fetch(`/api/admin/stops/${activeStopId}/reassign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverId: targetDriver.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reassign stop");
      }

      // Refresh route details
      await fetchRouteDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // Sortable Stop Component
  const SortableStopRow = ({ stop }: { stop: Stop }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: stop.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <tr
        ref={setNodeRef}
        style={style}
        className={`hover:bg-gray-50 ${isDragging ? 'bg-blue-50' : ''}`}
        {...attributes}
      >
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <div className="flex items-center">
            <div
              {...listeners}
              className="cursor-grab hover:cursor-grabbing mr-3 p-1 rounded hover:bg-gray-200"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
            {editingSequence === stop.id ? (
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  value={tempSequence}
                  onChange={(e) => setTempSequence(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveSequence(stop.id);
                    } else if (e.key === 'Escape') {
                      cancelEditingSequence();
                    }
                  }}
                />
                <button
                  onClick={() => saveSequence(stop.id)}
                  className="p-1 text-green-600 hover:text-green-800"
                  title="Save"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={cancelEditingSequence}
                  className="p-1 text-red-600 hover:text-red-800"
                  title="Cancel"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <span
                className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                onClick={() => startEditingSequence(stop.id, stop.sequence)}
                title="Click to edit sequence"
              >
                {stop.sequence}
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <div className="text-sm font-medium text-gray-900">
              {stop.customer.name}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {stop.customer.address}
              {stop.customer.groupCode && (
                <span className="ml-2 text-xs text-gray-400">
                  ({stop.customer.groupCode})
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.orderNumberWeb || "N/A"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.quickbooksInvoiceNum || "N/A"}
        </td>
        <td className="px-6 py-4 text-sm font-medium text-purple-900">
          {stop.creditMemos && stop.creditMemos.length > 0 ? (
            <div className="flex flex-col gap-1">
              {stop.creditMemos.map((cm) => (
                <div key={cm.id} className="text-xs">
                  {cm.creditMemoNumber}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-6 py-4 text-sm font-semibold text-purple-900">
          {stop.creditMemos && stop.creditMemos.length > 0 ? (
            <div className="flex flex-col gap-1">
              {stop.creditMemos.map((cm) => (
                <div key={cm.id} className="text-xs">
                  ${cm.creditMemoAmount.toFixed(2)}
                </div>
              ))}
              {stop.creditMemos.length > 1 && (
                <div className="text-xs font-bold border-t border-purple-300 pt-1 mt-1">
                  Total: ${stop.creditMemos.reduce((sum, cm) => sum + cm.creditMemoAmount, 0).toFixed(2)}
                </div>
              )}
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(
              stop.status
            )}`}
          >
            {stop.status.replace("_", " ")}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {editingPaymentTerms === stop.id ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={tempPaymentTerms}
                onChange={(e) => setTempPaymentTerms(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter terms..."
                autoFocus
                disabled={savingPaymentTerms}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => savePaymentTerms(stop.id)}
                  disabled={savingPaymentTerms}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {savingPaymentTerms ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEditingPaymentTerms}
                  disabled={savingPaymentTerms}
                  className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              <button
                onClick={() => startEditingPaymentTerms(stop)}
                className="font-medium text-left hover:text-blue-600 hover:underline"
              >
                {stop.paymentTerms || stop.customer?.paymentTerms || "COD"}
                {stop.paymentTerms === "Other" && stop.paymentTermsOther && (
                  <span className="text-xs text-gray-500 ml-1">({stop.paymentTermsOther})</span>
                )}
              </button>
              {stop.isCOD && (
                <span className="mt-1 px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-md bg-yellow-100 text-yellow-800 w-fit">
                  COD Flag
                </span>
              )}
            </div>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {getPaymentMethod(stop)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <div className="flex flex-col">
            {/* Show driver-recorded payment amount if available, otherwise show Excel amount */}
            <div className="text-sm font-bold text-blue-600">
              ${(stop.driverPaymentAmount || stop.totalPaymentAmount || 0).toFixed(2)}
            </div>
            {stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? (
              /* Show driver-recorded payment details */
              <div className="text-xs text-green-600 mt-1">
                Driver Recorded
              </div>
            ) : (stop.totalPaymentAmount || 0) > 0 ? (
              /* Show Excel payment breakdown */
              <div className="text-xs text-gray-500 mt-1">
                {(stop.paymentAmountCash || 0) > 0 && `Cash: $${(stop.paymentAmountCash || 0).toFixed(2)}`}
                {(stop.paymentAmountCash || 0) > 0 && ((stop.paymentAmountCheck || 0) > 0 || (stop.paymentAmountCC || 0) > 0) && ', '}
                {(stop.paymentAmountCheck || 0) > 0 && `Check: $${(stop.paymentAmountCheck || 0).toFixed(2)}`}
                {(stop.paymentAmountCheck || 0) > 0 && (stop.paymentAmountCC || 0) > 0 && ', '}
                {(stop.paymentAmountCC || 0) > 0 && `CC: $${(stop.paymentAmountCC || 0).toFixed(2)}`}
              </div>
            ) : null}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.amount ? `$${stop.amount.toFixed(2)}` : "N/A"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.hasReturns ? "Yes" : "No"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatDateTime(stop.arrivalTime)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatDateTime(stop.completionTime)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <Link
            href={`/admin/stops/${stop.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-900"
          >
            View Details
          </Link>
        </td>
      </tr>
    );
  };

  // Droppable Driver Section Component
  const DroppableDriverSection = ({ driverName, stops }: { driverName: string; stops: Stop[] }) => {
    const { setNodeRef, isOver } = useSortable({ id: driverName });
    const driverTotal = getTotalAmount(stops);
    const driverPaymentTotal = getTotalPaymentAmount(stops);

    return (
      <div
        ref={setNodeRef}
        className={`overflow-hidden ${isOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}`}
      >
        <div className={`bg-gray-100 px-6 py-3 border-l-4 border-blue-500 mb-4 ${isOver ? 'bg-blue-100' : ''}`}>
          <div className="flex justify-between items-center">
            <h3 className="text-md font-medium text-gray-800">
              Driver: {driverName} ({stops.length} stops)
              {isOver && <span className="ml-2 text-blue-600 font-semibold">Drop here to reassign</span>}
            </h3>
            <div className="text-right">
              <div className="text-md font-bold text-green-600">
                Order Total: ${driverTotal.toFixed(2)}
              </div>
              <div className="text-sm font-semibold text-blue-600">
                Payments: ${driverPaymentTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sequence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                  Credit Memo #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                  Credit Amt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Terms
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Returns
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Arrival
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completion
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {stops.map((stop) => (
                  <SortableStopRow key={stop.id} stop={stop} />
                ))}
              </SortableContext>
              {/* Driver Total Row */}
              <tr className="bg-blue-50 border-t-2 border-blue-300">
                <td colSpan={9} className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  Driver Payment Total:
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="text-md font-bold text-blue-600">
                    ${stops.reduce((total, stop) => total + (stop.driverPaymentAmount || stop.totalPaymentAmount || 0), 0).toFixed(2)}
                  </div>
                </td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  Driver Total:
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="text-md font-bold text-blue-600">
                    ${driverTotal.toFixed(2)}
                  </div>
                </td>
                <td colSpan={4} className="px-6 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* WebSocket Error Alert */}
      <WebSocketErrorAlert error={socketError} onReconnect={reconnect} />

      {/* Header with breadcrumb and actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center text-sm text-gray-500 mb-2">
              <Link href="/admin" className="hover:text-blue-600">
                Dashboard
              </Link>
              <svg
                className="h-4 w-4 mx-2"
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
              <Link href="/admin/routes" className="hover:text-blue-600">
                Routes
              </Link>
              <svg
                className="h-4 w-4 mx-2"
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
              <span className="font-medium text-gray-700">Route Details</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {route?.routeNumber || "Route Details"}
            </h1>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => router.push("/admin/routes")}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Routes
            </button>
            {route && (
              <>
                <button
                  onClick={() => setShowAddStopModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
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
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add Stop
                </button>
                <Link
                  href={`/admin/routes/${route.id}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  Edit Route
                </Link>
                <button
                  onClick={() => handleExportRoute('csv')}
                  disabled={exporting}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
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
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  onClick={() => handleExportRoute('json')}
                  disabled={exporting}
                  style={{ display: 'none' }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
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
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                  {exporting ? "Exporting..." : "Export JSON"}
                </button>
                {/* Generate Image PDF Button (replaces ZIP archive) */}
                <button
                  onClick={handleGenerateImagePDF}
                  disabled={isGeneratingImagePDF}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingImagePDF ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  )}
                  {isGeneratingImagePDF ? "Generating PDF..." : `Generate PDF Report (${route?.stops?.reduce((total, stop) => total + (stop.invoiceImageUrls?.length || 0), 0) || 0})`}
                </button>
                {/* Legacy ZIP Archive Button (kept for backward compatibility) */}
                <button
                  onClick={handleGenerateImageReport}
                  disabled={isGeneratingImageReport}
                  style={{ display: 'none' }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingImageReport ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
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
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                  {isGeneratingImageReport ? "Archiving..." : `Legacy ZIP Archive`}
                </button>
                {/* Send Bulk Emails Button */}
                <button
                  onClick={handleSendBulkEmails}
                  disabled={isSendingEmails}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingEmails ? (
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
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
                        d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                  {isSendingEmails ? "Sending..." : `Send Emails (${route?.stops?.filter(s => s.status === 'COMPLETED').length || 0})`}
                </button>
                {/* Delete Route - Super Admin Only */}
                {userRole === "SUPER_ADMIN" && (
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete Route
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Export Error Alert */}
      {exportError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl shadow-md mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-500"
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
              <h3 className="text-lg font-medium text-red-800">
                Export Error
              </h3>
              <p className="mt-1 text-red-700">{exportError}</p>
              <button
                onClick={() => setExportError("")}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-16 bg-white rounded-xl shadow-md">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-black"></div>
          <p className="mt-4 text-gray-600">Loading route details...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl shadow-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-red-500"
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
              <h3 className="text-lg font-medium text-red-800">
                Error Loading Route
              </h3>
              <p className="mt-1 text-red-700">{error}</p>
            </div>
          </div>
        </div>
      ) : route ? (
        <>
          {/* Route Summary */}
          <RouteSummary route={route} getStopsGroupedByDriver={getStopsGroupedByDriver} />

          {/* Stops List */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Stops ({route.stops.length})
              </h2>
              <div className="flex items-center">
                <label className="inline-flex items-center cursor-pointer">
                  <span className="mr-3 text-sm font-medium text-white">
                    Group by Driver
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={groupByDriver}
                      onChange={() => setGroupByDriver(!groupByDriver)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </div>
                </label>
              </div>
            </div>
            <div className="p-6">
              {route.stops.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
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
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    No stops found
                  </h3>
                  <p className="mt-2 text-gray-500 max-w-md mx-auto">
                    This route doesn't have any stops assigned yet. You can add
                    stops by uploading a route file.
                  </p>
                  <div className="mt-6">
                    <Link
                      href="/admin/routes/upload"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
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
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Upload Route File
                    </Link>
                  </div>
                </div>
              ) : groupByDriver ? (
                // Grouped by driver view with drag and drop
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="space-y-8">
                    <SortableContext
                      items={Object.keys(getStopsGroupedByDriver())}
                      strategy={verticalListSortingStrategy}
                    >
                      {Object.entries(getStopsGroupedByDriver()).map(
                        ([driverName, stops]) => (
                          <DroppableDriverSection
                            key={driverName}
                            driverName={driverName}
                            stops={stops}
                          />
                        )
                      )}
                    </SortableContext>
                  </div>
                  <DragOverlay>
                    {activeId && draggedStop ? (
                      <div className="bg-white shadow-lg rounded-lg p-4 border-2 border-blue-300">
                        <div className="flex items-center space-x-3">
                          <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                            {draggedStop.sequence}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {draggedStop.customerNameFromUpload}
                            </p>
                            <p className="text-xs text-gray-500">
                              Dragging to reassign driver...
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              ) : (
                // Regular view (not grouped)
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-100">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('sequence')}
                        >
                          <div className="flex items-center">
                            Seq
                            {sortField === 'sequence' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('driverNameFromUpload')}
                        >
                          <div className="flex items-center">
                            Driver
                            {sortField === 'driverNameFromUpload' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('customerNameFromUpload')}
                        >
                          <div className="flex items-center">
                            Customer
                            {sortField === 'customerNameFromUpload' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('quickbooksInvoiceNum')}
                        >
                          <div className="flex items-center">
                            Invoice #
                            {sortField === 'quickbooksInvoiceNum' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-purple-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('creditMemoNumber')}
                        >
                          <div className="flex items-center">
                            Credit Memo #
                            {sortField === 'creditMemoNumber' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-purple-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('creditMemoAmount')}
                        >
                          <div className="flex items-center">
                            Credit Amt
                            {sortField === 'creditMemoAmount' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('status')}
                        >
                          <div className="flex items-center">
                            Status
                            {sortField === 'status' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                        >
                          Payment Status
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('totalPaymentAmount')}
                        >
                          <div className="flex items-center">
                            Payment Amount
                            {sortField === 'totalPaymentAmount' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-200"
                          onClick={() => handleSort('amount')}
                        >
                          <div className="flex items-center">
                            Amount
                            {sortField === 'amount' && (
                              <svg className={`ml-1 h-4 w-4 ${sortDirection === 'asc' ? 'transform rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                        >
                          Returns
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedStops(route.stops)
                        .map((stop, index) => {
                          // Debug: Log credit memo data for stops with credit memos
                          if (stop.creditMemos && stop.creditMemos.length > 0) {
                            console.log(`Stop ${stop.sequence} (${stop.customer.name}) credit memos:`, {
                              count: stop.creditMemos.length,
                              creditMemos: stop.creditMemos.map(cm => ({
                                id: cm.id,
                                number: cm.creditMemoNumber,
                                amount: cm.creditMemoAmount
                              })),
                              stopId: stop.id
                            });
                          }
                          return (
                          <tr
                            key={stop.id}
                            className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold">
                                  {stop.sequence}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {stop.driverNameFromUpload ||
                                  (route.driver
                                    ? route.driver.username
                                    : "Unknown")}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <div className="text-sm font-medium text-gray-900">
                                  {stop.customer.name}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {stop.customer.address}
                                  {stop.customer.groupCode && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      ({stop.customer.groupCode})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stop.quickbooksInvoiceNum || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-purple-900">
                              {stop.creditMemos && stop.creditMemos.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {stop.creditMemos.map((cm) => (
                                    <div key={cm.id} className="text-xs">
                                      {cm.creditMemoNumber}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-purple-900">
                              {stop.creditMemos && stop.creditMemos.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {stop.creditMemos.map((cm) => (
                                    <div key={cm.id} className="text-xs">
                                      ${cm.creditMemoAmount.toFixed(2)}
                                    </div>
                                  ))}
                                  {stop.creditMemos.length > 1 && (
                                    <div className="text-xs font-bold border-t border-purple-300 pt-1 mt-1">
                                      Total: ${stop.creditMemos.reduce((sum, cm) => sum + cm.creditMemoAmount, 0).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                                  stop.status
                                )}`}
                              >
                                {stop.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">
                                  {getPaymentMethod(stop)}
                                </span>
                                <span className="mt-1 text-xs text-gray-500">
                                  Terms: {stop.customer?.paymentTerms || "COD"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                {/* Show driver-recorded payment amount if available, otherwise show Excel amount */}
                                <div className="text-sm font-bold text-blue-600">
                                  ${(stop.driverPaymentAmount || stop.totalPaymentAmount || 0).toFixed(2)}
                                </div>
                                {stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? (
                                  /* Show driver-recorded payment details */
                                  <div className="text-xs text-green-600 mt-1">
                                    Driver Recorded
                                  </div>
                                ) : (stop.totalPaymentAmount || 0) > 0 ? (
                                  /* Show Excel payment breakdown */
                                  <div className="text-xs text-gray-500 mt-1">
                                    {(stop.paymentAmountCash || 0) > 0 && `Cash: $${(stop.paymentAmountCash || 0).toFixed(2)}`}
                                    {(stop.paymentAmountCash || 0) > 0 && ((stop.paymentAmountCheck || 0) > 0 || (stop.paymentAmountCC || 0) > 0) && ', '}
                                    {(stop.paymentAmountCheck || 0) > 0 && `Check: $${(stop.paymentAmountCheck || 0).toFixed(2)}`}
                                    {(stop.paymentAmountCheck || 0) > 0 && (stop.paymentAmountCC || 0) > 0 && ', '}
                                    {(stop.paymentAmountCC || 0) > 0 && `CC: $${(stop.paymentAmountCC || 0).toFixed(2)}`}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-bold text-gray-900">
                                {stop.amount
                                  ? `$${stop.amount.toFixed(2)}`
                                  : "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {stop.hasReturns ? "Yes" : "No"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Link
                                href={`/admin/stops/${stop.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
                              >
                                <svg
                                  className="h-3.5 w-3.5 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                  />
                                </svg>
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                        })}
                      {/* Total Amount Row */}
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td colSpan={8} className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                          Total Payment Amount:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold text-blue-600">
                            ${route.stops.reduce((total, stop) => total + (stop.driverPaymentAmount || stop.totalPaymentAmount || 0), 0).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                          Total Amount:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold text-green-600">
                            ${route ? getTotalAmount(route.stops).toFixed(2) : '0.00'}
                          </div>
                        </td>
                        <td className="px-6 py-4"></td>
                        <td className="px-6 py-4"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <svg
            className="mx-auto h-20 w-20 text-gray-400"
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
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Route Not Found
          </h2>
          <p className="mt-3 text-gray-500 max-w-md mx-auto">
            The route you're looking for doesn't exist or you may not have
            permission to view it. It may have been deleted or the ID might be
            incorrect.
          </p>
          <div className="mt-8">
            <Link
              href="/admin/routes"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Routes
            </Link>
          </div>
        </div>
      )}

      {/* Add Stop Modal */}
      <AddStopModal
        show={showAddStopModal}
        onClose={handleCloseAddStopModal}
        onSubmit={handleAddStop}
        form={addStopForm}
        setForm={setAddStopForm}
        drivers={drivers}
        selectedCustomer={selectedCustomer}
        onCustomerSelect={handleCustomerSelect}
        adding={addingStop}
        error={error}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteRouteDialog
        show={showDeleteDialog}
        route={route}
        deleteWarning={deleteWarning}
        deleteError={deleteError}
        deleteLoading={deleteLoading}
        onResetDeleteDialog={resetDeleteDialog}
        onHandleDeleteRoute={handleDeleteRoute}
        onHandleForceDelete={handleForceDelete}
      />

      {/* Email Results Modal */}
      <EmailResultsModal
        show={showEmailResults}
        emailResults={emailResults}
        onClose={() => setShowEmailResults(false)}
      />
    </div>
  );
}
