"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { useSocket } from "@/contexts/SocketContext";
import { useOptimizedAdminStopDetails } from "@/hooks/useOptimizedSocketEvents";
import WebSocketErrorAlert from "@/components/ui/WebSocketErrorAlert";
import { formatDriverNotes } from "@/utils/notesFormatter";
import DocumentPreview from "@/components/admin/DocumentPreview";

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
  uploader: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

interface StopDocument {
  id: string;
  document: Document;
  isPrinted: boolean;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stop {
  id: string;
  sequence: number;
  status: string;
  customerNameFromUpload: string | null;
  driverNameFromUpload: string | null;
  orderNumberWeb: string | null;
  quickbooksInvoiceNum: string | null;
  creditMemoNumber: string | null;
  creditMemoAmount: number | null;
  initialDriverNotes: string | null;
  arrivalTime: string | null;
  completionTime: string | null;
  signedInvoicePdfUrl: string | null;
  invoiceImageUrls: string[];
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
  route: Route;
  adminNotes: AdminNote[];
  stopDocuments: StopDocument[];
  createdAt: string;
  updatedAt: string;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
  groupCode: string | null;
  email: string | null;
  documents: Document[];
}

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

interface AdminNote {
  id: string;
  note: string;
  adminId: string;
  stopId: string;
  readByDriver: boolean;
  readByDriverAt: string | null;
  createdAt: string;
  updatedAt: string;
  admin: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

interface ReturnItem {
  id: string;
  stopId: string;
  item: string;
  quantity: number;
  reasonCode: string;
  orderItemIdentifier?: string;
  productDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export default function StopDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Unwrap params with React.use()
  const unwrappedParams = React.use(params as Promise<{ id: string }>);
  const stopId = unwrappedParams.id;

  const [stop, setStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    sequence: 0,
    status: "",
    initialDriverNotes: "",
    isCOD: false,
    amount: 0,
  });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailError, setEmailError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editedNoteContent, setEditedNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [returnsError, setReturnsError] = useState("");

  // Driver reassignment state
  const [drivers, setDrivers] = useState<any[]>([]);
  const [reassigningDriver, setReassigningDriver] = useState(false);
  const [showDriverSelect, setShowDriverSelect] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  // QuickBooks invoice number edit state
  const [showQuickBooksEdit, setShowQuickBooksEdit] = useState(false);
  const [quickBooksValue, setQuickBooksValue] = useState("");
  const [updatingQuickBooks, setUpdatingQuickBooks] = useState(false);

  const router = useRouter();

  // Initialize socket connection
  const { isConnected, joinRoom, error: socketError, reconnect } = useSocket();

  // Define fetchStopDetails as a useCallback to avoid dependency issues
  const fetchStopDetails = useCallback(async () => {
    setLoading(true);
    setError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch stop details");
      }

      const data = await response.json();
      console.log("Stop data:", data); // Log the stop data to verify driverNameFromUpload
      setStop(data);
      setFormData({
        sequence: data.sequence,
        status: data.status,
        initialDriverNotes: data.initialDriverNotes || "",
        isCOD: data.isCOD,
        amount: data.amount || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [stopId, router]);

  const fetchReturns = useCallback(async () => {
    setLoadingReturns(true);
    setReturnsError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}/returns`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch returns");
      }

      const data = await response.json();
      setReturns(data.returns || []);
    } catch (err) {
      setReturnsError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching returns:", err);
    } finally {
      setLoadingReturns(false);
    }
  }, [stopId, router]);

  // Fetch drivers for reassignment
  const fetchDrivers = useCallback(async () => {
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
  }, [router]);

  // Reassign driver function
  const handleReassignDriver = async () => {
    if (!selectedDriverId || !stop) return;

    setReassigningDriver(true);
    setError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}/reassign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          driverId: selectedDriverId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reassign driver");
      }

      // Refresh stop details to show updated driver
      await fetchStopDetails();
      setShowDriverSelect(false);
      setSelectedDriverId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setReassigningDriver(false);
    }
  };

  // Update QuickBooks invoice number function
  const handleUpdateQuickBooks = async () => {
    if (!stop) return;

    setUpdatingQuickBooks(true);
    setError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quickbooksInvoiceNum: quickBooksValue.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update QuickBooks invoice number");
      }

      // Refresh stop details to show updated QuickBooks number
      await fetchStopDetails();
      setShowQuickBooksEdit(false);
      setQuickBooksValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUpdatingQuickBooks(false);
    }
  };

  useEffect(() => {
    fetchStopDetails();
    fetchReturns();
    fetchDrivers();
  }, [stopId, fetchStopDetails, fetchReturns]);

  // Use optimized admin stop details hook for real-time updates
  const { stop: optimizedStop } = useOptimizedAdminStopDetails(stopId, stop);

  // Update the stop state when optimizedStop changes
  useEffect(() => {
    if (optimizedStop && optimizedStop._lastUpdated) {
      // Use _lastUpdated timestamp to determine if this is actually a new update
      const currentLastUpdated = stop?._lastUpdated;
      const newLastUpdated = optimizedStop._lastUpdated;

      if (newLastUpdated !== currentLastUpdated) {
        console.log(
          `[AdminStopDetails] Received optimized stop update:`,
          optimizedStop.status,
          optimizedStop._lastUpdated
        );

        // Update with the optimized stop data (no need for _forceUpdate hack)
        setStop(optimizedStop);

        // Also update the form data if we're in edit mode
        if (editMode) {
          setFormData((prevFormData) => ({
            ...prevFormData,
            status: optimizedStop.status,
          }));
        }
      }
    }
  }, [optimizedStop, editMode]); // Removed 'stop' from dependencies to prevent infinite loop

  // Set up WebSocket connection for room joining only
  useEffect(() => {
    if (!isConnected || !stop) return;

    // Join the admin room and the specific route room
    joinRoom("admin");

    if (stop.route.id) {
      joinRoom(`route:${stop.route.id}`);
    }

    // No need for polling as we're using optimized hooks for real-time updates
    return () => {
      // No cleanup needed for subscriptions as they're handled by the hooks
    };
  }, [isConnected, stop, joinRoom]);

  // fetchReturns is already defined above as a useCallback

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setAddingNote(true);
    setNoteSuccess("");
    setError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: newNote }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error response:", errorData);
        throw new Error(errorData.message || "Failed to add note");
      }

      const data = await response.json().catch(() => ({}));
      console.log("Note added successfully:", data);

      setNoteSuccess("Note added successfully");
      setNewNote("");
      fetchStopDetails(); // Refresh the stop details to show the new note
    } catch (err) {
      console.error("Error adding note:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditNote = (noteId: string, noteContent: string) => {
    setEditingNoteId(noteId);
    setEditedNoteContent(noteContent);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditedNoteContent("");
  };

  const handleSaveEditedNote = async (noteId: string) => {
    if (!editedNoteContent.trim()) return;

    setEditingNote(true);
    setNoteSuccess("");
    setError("");

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

      const response = await fetch(`/api/admin/notes/${noteId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: editedNoteContent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update note");
      }

      setNoteSuccess("Note updated successfully");
      setEditingNoteId(null);
      setEditedNoteContent("");
      fetchStopDetails(); // Refresh the stop details to show the updated note
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setEditingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    setDeletingNoteId(noteId);
    setNoteSuccess("");
    setError("");

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

      const response = await fetch(`/api/admin/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete note");
      }

      setNoteSuccess("Note deleted successfully");
      fetchStopDetails(); // Refresh the stop details to remove the deleted note
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess("");
    setError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update stop");
      }

      const updatedStop = await response.json();
      setStop(updatedStop);
      setSaveSuccess("Stop updated successfully");
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    setEmailSuccess("");
    setEmailError("");

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

      const response = await fetch(`/api/admin/stops/${stopId}/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send email");
      }

      await response.json(); // We don't need to use the data
      setEmailSuccess("Email sent successfully!");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error sending email:", err);
    } finally {
      setSendingEmail(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center">
        <svg
          className="mx-auto h-20 w-20 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">Error</h2>
        <p className="mt-3 text-gray-500">{error}</p>
        <div className="mt-8">
          <button
            onClick={() => router.push("/admin/routes")}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700"
          >
            Back to Routes
          </button>
        </div>
      </div>
    );
  }

  if (!stop) {
    return (
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h2 className="mt-6 text-2xl font-bold text-gray-900">
          Stop Not Found
        </h2>
        <p className="mt-3 text-gray-500">
          The stop you&apos;re looking for doesn&apos;t exist or you may not
          have permission to view it.
        </p>
        <div className="mt-8">
          <button
            onClick={() => router.push("/admin/routes")}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700"
          >
            Back to Routes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* WebSocket Error Alert */}
      <WebSocketErrorAlert error={socketError} onReconnect={reconnect} />

      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center text-sm text-gray-500 mb-1">
              <Link href="/admin/routes" className="hover:text-primary-blue">
                Routes
              </Link>
              <svg
                className="h-4 w-4 mx-1"
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
              <Link
                href={`/admin/routes/${stop.route.id}`}
                className="hover:text-primary-blue"
              >
                Route {stop.route.routeNumber || stop.route.id.substring(0, 8)}
              </Link>
              <svg
                className="h-4 w-4 mx-1"
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
              <span className="font-medium text-gray-700">Stop Details</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Stop #{stop.sequence}: {stop.customer.name}
            </h1>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => router.push(`/admin/routes/${stop.route.id}`)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
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
              Back to Route
            </button>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700"
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
                Edit Stop
              </button>
            ) : (
              <button
                onClick={() => setEditMode(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Messages */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {saveSuccess}
        </div>
      )}

      {noteSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {noteSuccess}
        </div>
      )}

      {emailSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {emailSuccess}
        </div>
      )}

      {/* Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {emailError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {emailError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stop Details */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-mono-200">
              <h2 className="text-lg font-medium text-mono-800">
                Stop Details
              </h2>
            </div>

            {editMode ? (
              <form onSubmit={handleSaveChanges} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="sequence"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Sequence
                    </label>
                    <input
                      type="number"
                      id="sequence"
                      value={formData.sequence}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sequence: parseInt(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="status"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Status
                    </label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="ON_THE_WAY">On The Way</option>
                      <option value="ARRIVED">Arrived</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="FAILED">Failed</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="amount"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Amount
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">$</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        id="amount"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            amount: parseFloat(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border-mono-300 shadow-sm pl-7 focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center h-full">
                      <input
                        type="checkbox"
                        id="isCOD"
                        checked={formData.isCOD}
                        onChange={(e) =>
                          setFormData({ ...formData, isCOD: e.target.checked })
                        }
                        className="h-4 w-4 text-primary-blue border-mono-300 rounded focus:ring-primary-blue"
                      />
                      <label
                        htmlFor="isCOD"
                        className="ml-2 block text-sm font-medium text-gray-700"
                      >
                        Cash on Delivery (COD)
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="initialDriverNotes"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Driver Notes
                  </label>
                  <textarea
                    id="initialDriverNotes"
                    value={formData.initialDriverNotes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        initialDriverNotes: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                  ></textarea>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Route</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      <Link
                        href={`/admin/routes/${stop.route.id}`}
                        className="text-primary-blue hover:underline"
                      >
                        {stop.route.routeNumber ||
                          `Route ${stop.route.id.substring(0, 8)}`}
                      </Link>
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Date</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {formatDate(stop.route.date)}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Driver
                    </h3>
                    {showDriverSelect ? (
                      <div className="mt-1 flex items-center space-x-2">
                        <select
                          value={selectedDriverId}
                          onChange={(e) => setSelectedDriverId(e.target.value)}
                          className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-blue"
                        >
                          <option value="">Select a driver</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.fullName || driver.username}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleReassignDriver}
                          disabled={!selectedDriverId || reassigningDriver}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reassigningDriver ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setShowDriverSelect(false);
                            setSelectedDriverId("");
                          }}
                          className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center space-x-2">
                        <p className="text-sm text-gray-900">
                          {stop.driverNameFromUpload ||
                            stop.route.driver.fullName ||
                            stop.route.driver.username}
                        </p>
                        <button
                          onClick={() => setShowDriverSelect(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Status
                    </h3>
                    <div className="mt-1">
                      <StatusBadge status={stop.status} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Sequence
                    </h3>
                    <p className="mt-1 text-sm text-gray-900">
                      #{stop.sequence}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Amount
                    </h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {stop.amount ? `$${stop.amount.toFixed(2)}` : "N/A"}
                    </p>
                  </div>

                  {/* Delivery Times */}
                  {(stop.arrivalTime || stop.completionTime) && (
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium text-gray-500">
                        Delivery Times
                      </h3>
                      <div className="mt-1 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Arrival</p>
                          <p className="text-sm text-gray-900">
                            {stop.arrivalTime ? formatDate(stop.arrivalTime) : "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Completion</p>
                          <p className="text-sm text-gray-900">
                            {stop.completionTime ? formatDate(stop.completionTime) : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Payment Type
                    </h3>
                    <div className="mt-1 space-y-2">
                      {/* Driver-recorded payments (priority display) */}
                      {stop.payments && stop.payments.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-green-700 mb-1">
                            Driver Recorded:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {stop.payments.map((payment: any, index: number) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                              >
                                {payment.method}: ${payment.amount.toFixed(2)}
                                {payment.notes && ` (${payment.notes})`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Excel payment flags (secondary display) */}
                      <div>
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          Excel Flags:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {stop.isCOD && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              COD
                            </span>
                          )}
                          {stop.paymentFlagCash && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Cash Flag
                            </span>
                          )}
                          {stop.paymentFlagCheck && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Check Flag
                            </span>
                          )}
                          {stop.paymentFlagCC && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              Credit Card Flag
                            </span>
                          )}
                          {stop.paymentFlagNotPaid && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Not Paid Flag
                            </span>
                          )}
                          {!stop.paymentFlagCash &&
                            !stop.paymentFlagCheck &&
                            !stop.paymentFlagCC &&
                            !stop.paymentFlagNotPaid &&
                            !stop.isCOD && (
                              <span className="text-xs text-gray-500">
                                No flags set
                              </span>
                            )}
                        </div>
                      </div>

                      {/* Show message if no payments recorded */}
                      {(!stop.payments || stop.payments.length === 0) &&
                       !stop.paymentFlagCash && !stop.paymentFlagCheck &&
                       !stop.paymentFlagCC && !stop.paymentFlagNotPaid && !stop.isCOD && (
                        <div className="text-sm text-gray-500">
                          No payment information available
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500">
                      Order Numbers
                    </h3>
                    <div className="mt-1 space-y-2">
                      {stop.orderNumberWeb && (
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">Web:</span>{" "}
                          {stop.orderNumberWeb}
                        </p>
                      )}

                      {/* QuickBooks Invoice Number with Edit Functionality */}
                      <div>
                        <span className="text-sm font-medium text-gray-900">QuickBooks: </span>
                        {showQuickBooksEdit ? (
                          <div className="mt-1 flex items-center space-x-2">
                            <input
                              type="text"
                              value={quickBooksValue}
                              onChange={(e) => setQuickBooksValue(e.target.value)}
                              placeholder="Enter QuickBooks invoice number"
                              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-blue flex-1"
                            />
                            <button
                              onClick={handleUpdateQuickBooks}
                              disabled={updatingQuickBooks}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {updatingQuickBooks ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setShowQuickBooksEdit(false);
                                setQuickBooksValue("");
                              }}
                              className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-2">
                            <span className="text-sm text-gray-900">
                              {stop.quickbooksInvoiceNum || "Not specified"}
                            </span>
                            <button
                              onClick={() => {
                                setShowQuickBooksEdit(true);
                                setQuickBooksValue(stop.quickbooksInvoiceNum || "");
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Change
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Credit Memo Information */}
                      {(stop.creditMemoNumber || stop.creditMemoAmount) && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-purple-800 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            Credit Memo
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {stop.creditMemoNumber && (
                              <div>
                                <span className="font-medium text-purple-700">Number:</span>
                                <span className="ml-2 text-purple-900">{stop.creditMemoNumber}</span>
                              </div>
                            )}
                            {stop.creditMemoAmount && (
                              <div>
                                <span className="font-medium text-purple-700">Amount:</span>
                                <span className="ml-2 text-purple-900 font-semibold">${stop.creditMemoAmount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Driver Notes */}
                {(stop.initialDriverNotes || stop.driverNotes) && (
                  <div className="space-y-4">
                    {stop.initialDriverNotes && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">
                          Initial Driver Notes
                        </h3>
                        <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-900 whitespace-pre-wrap">
                            {formatDriverNotes(stop.initialDriverNotes)}
                          </p>
                        </div>
                      </div>
                    )}

                    {stop.driverNotes && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">
                          Completion Notes
                        </h3>
                        <div className="mt-1 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-900">
                            {stop.driverNotes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Returns */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-mono-200">
              <h2 className="text-lg font-medium text-mono-800">Returns</h2>
            </div>
            <div className="p-6">
              {loadingReturns ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
                </div>
              ) : returnsError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {returnsError}
                </div>
              ) : returns.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"
                    />
                  </svg>
                  <p className="mt-2">No returns for this stop</p>
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
                          Item
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Quantity
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Reason
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {returns.map((returnItem) => (
                        <tr key={returnItem.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {returnItem.orderItemIdentifier}
                            </div>
                            {returnItem.productDescription && (
                              <div className="text-sm text-gray-500">
                                {returnItem.productDescription}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {returnItem.quantity}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              {returnItem.reasonCode}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(returnItem.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Signed Invoice PDF */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-mono-200">
              <h2 className="text-lg font-medium text-mono-800">Signed Invoice</h2>
            </div>
            <div className="p-6">
              {stop.signedInvoicePdfUrl ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                    <svg
                      className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0"
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
                    <div>
                      <p className="text-sm text-green-700 font-medium">
                        Invoice photo uploaded and converted to PDF
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Driver has completed the invoice upload process
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={stop.signedInvoicePdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition duration-200"
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
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      View PDF
                    </a>

                    <a
                      href={stop.signedInvoicePdfUrl}
                      download={`invoice-${stop.quickbooksInvoiceNum || stop.id}.pdf`}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition duration-200"
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
                          d="M12 10v6m0 0l-3-3m3 3l3-3M4 16l4 4m0 0l4-4m-4 4V4"
                        />
                      </svg>
                      Download PDF
                    </a>
                  </div>

                  {/* PDF Preview */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-700">PDF Preview</h3>
                    </div>
                    <div className="p-4">
                      <iframe
                        src={stop.signedInvoicePdfUrl}
                        className="w-full h-96 border-0"
                        title="Signed Invoice PDF"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="mt-2">No signed invoice uploaded yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    The driver will upload the signed invoice when completing the delivery
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Invoice Images Preview */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-mono-200">
              <h2 className="text-lg font-medium text-mono-800">Invoice Images</h2>
            </div>
            <div className="p-6">
              {stop.invoiceImageUrls && stop.invoiceImageUrls.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                    <svg
                      className="h-5 w-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0"
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
                    <div>
                      <p className="text-sm text-blue-700 font-medium">
                        {stop.invoiceImageUrls.length} image{stop.invoiceImageUrls.length !== 1 ? 's' : ''} uploaded
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Driver uploaded delivery photos for verification
                      </p>
                    </div>
                  </div>

                  {/* Image Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stop.invoiceImageUrls.map((imageUrl, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                          <h4 className="text-sm font-medium text-gray-700">
                            📷 Photo {index + 1}
                          </h4>
                        </div>
                        <div className="p-2">
                          <img
                            src={imageUrl}
                            alt={`Invoice photo ${index + 1}`}
                            className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(imageUrl, '_blank')}
                          />
                        </div>
                        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            View Full Size
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="mt-2">No invoice images uploaded yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Images will appear here when the driver uploads them
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Admin Notes */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-mono-200">
              <h2 className="text-lg font-medium text-mono-800">Admin Notes</h2>
            </div>

            <div className="p-6">
              {noteSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {noteSuccess}
                </div>
              )}

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={handleAddNote} className="mb-6">
                <div>
                  <label
                    htmlFor="newNote"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Add Note
                  </label>
                  <textarea
                    id="newNote"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                    placeholder="Add a note for the driver..."
                  ></textarea>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={addingNote || !newNote.trim()}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {addingNote ? "Adding..." : "Add Note"}
                  </button>
                </div>
              </form>

              {stop.adminNotes.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  <p className="mt-2">No admin notes yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stop.adminNotes.map((note) => (
                    <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          <div className="bg-gray-800 text-white rounded-full h-8 w-8 flex items-center justify-center">
                            {note.admin.fullName
                              ? note.admin.fullName.charAt(0)
                              : note.admin.username.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">
                              {note.admin.fullName || note.admin.username}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(note.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {note.readByDriver ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Read
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Unread
                            </span>
                          )}
                          {editingNoteId !== note.id && (
                            <>
                              <button
                                onClick={() =>
                                  handleEditNote(note.id, note.note)
                                }
                                className="text-gray-500 hover:text-gray-700"
                                title="Edit note"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
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
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-gray-500 hover:text-red-700"
                                title="Delete note"
                                disabled={deletingNoteId === note.id}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
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
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        {editingNoteId === note.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editedNoteContent}
                              onChange={(e) =>
                                setEditedNoteContent(e.target.value)
                              }
                              rows={3}
                              className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                            ></textarea>
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={handleCancelEditNote}
                                className="px-3 py-1 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEditedNote(note.id)}
                                disabled={
                                  editingNote || !editedNoteContent.trim()
                                }
                                className="px-3 py-1 text-sm text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50"
                              >
                                {editingNote ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-900">{note.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-mono-200">
              <h2 className="text-lg font-medium text-mono-800">
                Customer Details
              </h2>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Name</h3>
                <p className="mt-1 text-sm text-gray-900">
                  <Link
                    href={`/admin/customers/${stop.customer.id}`}
                    className="text-primary-blue hover:underline"
                  >
                    {stop.customer.name}
                  </Link>
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500">Address</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {stop.customer.address}
                </p>
              </div>

              {stop.customer.contactInfo && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">
                    Contact Info
                  </h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {stop.customer.contactInfo}
                  </p>
                </div>
              )}

              {stop.customer.preferences && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">
                    Preferences
                  </h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {stop.customer.preferences}
                  </p>
                </div>
              )}

              {stop.customer.groupCode && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">
                    Group Code
                  </h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {stop.customer.groupCode}
                  </p>
                </div>
              )}

              <div className="pt-4 space-y-3">
                <Link
                  href={`/admin/customers/${stop.customer.id}`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 w-full justify-center"
                >
                  View Full Customer Details
                </Link>

                {stop.status === "COMPLETED" && stop.customer.email && (
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingEmail ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                        Sending...
                      </>
                    ) : (
                      <>
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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        Send Customer Email
                      </>
                    )}
                  </button>
                )}

                {stop.status === "COMPLETED" && !stop.customer.email && (
                  <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
                    <p>
                      Customer email not available. Add an email to the customer
                      profile to enable sending delivery confirmation emails.
                    </p>
                  </div>
                )}

                {stop.status !== "COMPLETED" && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                    <p>
                      Delivery confirmation emails can only be sent after the
                      delivery is completed.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Document Preview Section */}
        <DocumentPreview
          customerDocuments={stop.customer.documents}
          stopDocuments={stop.stopDocuments}
          customerName={stop.customer.name}
        />
      </div>
    </div>
  );
}
