"use client";

import { useState, useEffect, use, useCallback } from "react";
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

interface Driver {
  id: string;
  username: string;
  fullName?: string;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
  groupCode: string | null;
}

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string | null;
  driverNameFromUpload: string | null; // Added driver name from upload
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
}

interface Driver {
  id: string;
  username: string;
  fullName: string | null;
}

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  driver: Driver;
  stops: Stop[];
}

export default function RouteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Unwrap the params object using React.use()
  const unwrappedParams = use(params);
  const routeId = unwrappedParams.id;

  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [groupByDriver, setGroupByDriver] = useState(true); // State to toggle grouping by driver
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteWarning, setDeleteWarning] = useState<{
    message: string;
    completedStops: number;
    totalStops: number;
  } | null>(null);

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

  // User role state
  const [userRole, setUserRole] = useState<string | null>(null);

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
  const { isConnected, joinRoom, socketError, reconnect } = useSocket();

  // Define fetchRouteDetails as a useCallback to avoid dependency issues
  const fetchRouteDetails = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/routes/${routeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch route details");
      }

      const data = await response.json();
      setRoute(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [token, routeId]);

  useEffect(() => {
    // Get the token and role from localStorage/sessionStorage
    let storedToken = localStorage.getItem("token");
    let storedRole = localStorage.getItem("userRole");

    // If not found in localStorage, check sessionStorage
    if (!storedToken) {
      storedToken = sessionStorage.getItem("token");
      storedRole = sessionStorage.getItem("userRole");
    }

    if (!storedToken || !["ADMIN", "SUPER_ADMIN"].includes(storedRole || "")) {
      router.push("/login");
      return;
    }

    setToken(storedToken);
    setUserRole(storedRole);
  }, [router]);

  useEffect(() => {
    if (token) {
      fetchRouteDetails();
      fetchDrivers();
    }
  }, [token, fetchRouteDetails]);

  // Fetch drivers for the dropdown
  const fetchDrivers = async () => {
    if (!token) return;

    try {
      const response = await fetch("/api/admin/drivers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDrivers(data);
      }
    } catch (error) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
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

  // Calculate total amount
  const getTotalAmount = () => {
    if (!route) return 0;
    return route.stops.reduce((total, stop) => total + (stop.amount || 0), 0);
  };

  // Export route data
  const handleExportRoute = async (format: 'csv' | 'json' = 'csv') => {
    if (!route) return;

    setExporting(true);
    setExportError("");

    try {
      // Check both localStorage and sessionStorage
      let token = localStorage.getItem("token");

      // If not found in localStorage, check sessionStorage
      if (!token) {
        token = sessionStorage.getItem("token");
      }

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/routes/${route.id}/export?format=${format}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to export route");
      }

      if (format === 'json') {
        // For JSON, download as file
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `route-${route.routeNumber || route.id}-${new Date(route.date).toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // For CSV, the response is already set up for download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `route-${route.routeNumber || route.id}-${new Date(route.date).toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "An error occurred during export");
    } finally {
      setExporting(false);
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

  // Delete route functions
  const handleDeleteRoute = async () => {
    if (!token || !route) return;

    setDeleteLoading(true);
    setDeleteError("");
    setDeleteWarning(null);

    try {
      const response = await fetch(`/api/admin/routes/${route.id}/delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.status === 409) {
        // Route has completed stops, show warning
        setDeleteWarning({
          message: data.warning,
          completedStops: data.completedStops,
          totalStops: data.totalStops,
        });
        setDeleteLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete route");
      }

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
      setDeleteError(err instanceof Error ? err.message : "An error occurred");
      setDeleteLoading(false);
    }
  };

  const handleForceDelete = async () => {
    if (!token || !route) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/admin/routes/${route.id}/delete?force=true`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete route");
      }

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

  // Add Stop Functions
  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStopForm.customerNameFromUpload || !addStopForm.driverId) {
      setError("Customer name and driver are required");
      return;
    }

    setAddingStop(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/routes/${routeId}/stops`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...addStopForm,
          amount: addStopForm.amount ? parseFloat(addStopForm.amount) : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to add stop");
      }

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
      setShowAddStopModal(false);

      // Refresh route details
      await fetchRouteDetails();
    } catch (err) {
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
            {stop.sequence}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.customerNameFromUpload}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.orderNumberWeb || "N/A"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.quickbooksInvoiceNum || "N/A"}
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
          {stop.isCOD ? "Yes" : "No"}
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
                {stop.paymentAmountCash > 0 && `Cash: $${stop.paymentAmountCash.toFixed(2)}`}
                {stop.paymentAmountCash > 0 && (stop.paymentAmountCheck > 0 || stop.paymentAmountCC > 0) && ', '}
                {stop.paymentAmountCheck > 0 && `Check: $${stop.paymentAmountCheck.toFixed(2)}`}
                {stop.paymentAmountCheck > 0 && stop.paymentAmountCC > 0 && ', '}
                {stop.paymentAmountCC > 0 && `CC: $${stop.paymentAmountCC.toFixed(2)}`}
              </div>
            ) : null}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {stop.amount ? `$${stop.amount.toFixed(2)}` : "N/A"}
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

  // Calculate total amount for a specific driver
  const getDriverTotalAmount = (stops: Stop[]) => {
    return stops.reduce((total, stop) => total + (stop.amount || 0), 0);
  };

  // Droppable Driver Section Component
  const DroppableDriverSection = ({ driverName, stops }: { driverName: string; stops: Stop[] }) => {
    const { setNodeRef, isOver } = useSortable({ id: driverName });
    const driverTotal = getDriverTotalAmount(stops);

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
            <div className="text-md font-bold text-green-600">
              Total: ${driverTotal.toFixed(2)}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  COD
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
                <td colSpan={7} className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  Driver Payment Total:
                </td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="text-md font-bold text-blue-600">
                    ${stops.reduce((total, stop) => total + (stop.totalPaymentAmount || 0), 0).toFixed(2)}
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
                <td colSpan={3} className="px-6 py-3"></td>
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
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white border-b border-gray-200">
              <h2 className="text-lg font-semibold">Route Summary</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg
                      className="h-5 w-5 text-gray-500 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-gray-500">
                      Route Number
                    </h3>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {route.routeNumber || "N/A"}
                  </p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg
                      className="h-5 w-5 text-gray-500 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-gray-500">Date</h3>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {formatDate(route.date)}
                  </p>
                </div>

                {/* Hide the route driver since it's just a placeholder */}
                {route.driver && route.driver.username !== "Route Admin" && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <svg
                        className="h-5 w-5 text-gray-500 mr-2"
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
                      <h3 className="text-sm font-medium text-gray-500">
                        Driver
                      </h3>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {route.driver?.fullName ||
                        route.driver?.username ||
                        "Unknown Driver"}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg
                      className="h-5 w-5 text-gray-500 mr-2"
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
                    <h3 className="text-sm font-medium text-gray-500">
                      Status
                    </h3>
                  </div>
                  <span
                    className={`px-3 py-1 inline-flex text-sm font-medium rounded-full ${getStatusBadgeClass(
                      route.status
                    )}`}
                  >
                    {route.status.replace("_", " ")}
                  </span>
                </div>

                {/* Drivers Assigned */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center mb-2">
                    <svg
                      className="h-5 w-5 text-gray-500 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-gray-500">
                      Drivers Assigned
                    </h3>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    {Object.keys(getStopsGroupedByDriver()).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

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
                          className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedStops(route.stops)
                        .map((stop, index) => (
                          <tr
                            key={stop.id}
                            className={`hover:bg-gray-50 transition-colors duration-150 ${
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
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
                                {stop.isCOD && (
                                  <span className="mt-1 px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-md bg-red-100 text-red-800 w-fit">
                                    COD
                                  </span>
                                )}
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
                                    {stop.paymentAmountCash > 0 && `Cash: $${stop.paymentAmountCash.toFixed(2)}`}
                                    {stop.paymentAmountCash > 0 && (stop.paymentAmountCheck > 0 || stop.paymentAmountCC > 0) && ', '}
                                    {stop.paymentAmountCheck > 0 && `Check: $${stop.paymentAmountCheck.toFixed(2)}`}
                                    {stop.paymentAmountCheck > 0 && stop.paymentAmountCC > 0 && ', '}
                                    {stop.paymentAmountCC > 0 && `CC: $${stop.paymentAmountCC.toFixed(2)}`}
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
                        ))}
                      {/* Total Amount Row */}
                      <tr className="bg-gray-50 border-t-2 border-gray-300">
                        <td colSpan={6} className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                          Total Payment Amount:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold text-blue-600">
                            ${route.stops.reduce((total, stop) => total + (stop.totalPaymentAmount || 0), 0).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-gray-900">
                          Total Amount:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-bold text-green-600">
                            ${getTotalAmount().toFixed(2)}
                          </div>
                        </td>
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
      {showAddStopModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Stop</h3>
                <button
                  onClick={() => setShowAddStopModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddStop} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={addStopForm.customerNameFromUpload}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, customerNameFromUpload: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign to Driver *
                    </label>
                    <select
                      value={addStopForm.driverId}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, driverId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a driver</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.fullName || driver.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Number
                    </label>
                    <input
                      type="text"
                      value={addStopForm.orderNumberWeb}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, orderNumberWeb: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={addStopForm.quickbooksInvoiceNum}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, quickbooksInvoiceNum: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={addStopForm.address}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Info
                    </label>
                    <input
                      type="text"
                      value={addStopForm.contactInfo}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, contactInfo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={addStopForm.amount}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isCOD"
                      checked={addStopForm.isCOD}
                      onChange={(e) => setAddStopForm(prev => ({ ...prev, isCOD: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isCOD" className="ml-2 block text-sm text-gray-900">
                      Cash on Delivery (COD)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driver Notes
                  </label>
                  <textarea
                    value={addStopForm.initialDriverNotes}
                    onChange={(e) => setAddStopForm(prev => ({ ...prev, initialDriverNotes: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Any special instructions for the driver..."
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddStopModal(false)}
                    disabled={addingStop}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingStop}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center"
                  >
                    {addingStop && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Add Stop
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="mt-4 text-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Route
                </h3>
                <div className="mt-2 px-7 py-3">
                  {deleteWarning ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">
                        {deleteWarning.message}
                      </p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg
                              className="h-5 w-5 text-yellow-400"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              <strong>Warning:</strong> This route has {deleteWarning.completedStops} completed stops out of {deleteWarning.totalStops} total stops.
                              Deleting this route will permanently remove all delivery data and cannot be undone.
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        Are you sure you want to permanently delete this route and all its data?
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete route "{route?.routeNumber}"?
                      This action cannot be undone and will permanently remove the route and all its stops.
                    </p>
                  )}
                </div>

                {deleteError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-red-400"
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
                        <p className="text-sm text-red-700">{deleteError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-center space-x-3 mt-6">
                  <button
                    onClick={resetDeleteDialog}
                    disabled={deleteLoading}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  {deleteWarning ? (
                    <button
                      onClick={handleForceDelete}
                      disabled={deleteLoading}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
                    >
                      {deleteLoading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      Force Delete
                    </button>
                  ) : (
                    <button
                      onClick={handleDeleteRoute}
                      disabled={deleteLoading}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
                    >
                      {deleteLoading && (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      Delete Route
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
