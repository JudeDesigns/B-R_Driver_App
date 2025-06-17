"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

interface Route {
  id: string;
  routeNumber: string;
  date: string;
  status: string;
  stops: Stop[];
}

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string;
  driverNameFromUpload: string;
  status: string;
  stopDocuments: StopDocument[];
}

interface StopDocument {
  id: string;
  isPrinted: boolean;
  printedAt?: string;
  document: Document;
}

interface Document {
  id: string;
  title: string;
  description?: string;
  type: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export default function DocumentsPage() {
  // Use the Admin auth hook (allows both ADMIN and SUPER_ADMIN)
  const { token, userRole, isLoading: authLoading, isAuthenticated } = useAdminAuth();

  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<"route" | "driver">("route");
  const [expandedDrivers, setExpandedDrivers] = useState<Set<string>>(new Set());
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    type: "OTHER",
    file: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  const documentTypes = [
    { value: "INVOICE", label: "Invoice" },
    { value: "CREDIT_MEMO", label: "Credit Memo" },
    { value: "DELIVERY_RECEIPT", label: "Statement" },
    { value: "RETURN_FORM", label: "Return Form" },
    { value: "OTHER", label: "Other" },
  ];

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchTodaysRoutes();
    }
  }, [token, isAuthenticated]);

  const fetchTodaysRoutes = async () => {
    try {
      const response = await fetch("/api/admin/routes/today", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch today's routes");
      }

      const data = await response.json();
      setRoutes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title || !uploadForm.type || !selectedStopId) {
      setError("Please fill in all required fields");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // First upload the document
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("title", uploadForm.title);
      formData.append("description", uploadForm.description);
      formData.append("type", uploadForm.type);

      const uploadResponse = await fetch("/api/admin/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || "Failed to upload document");
      }

      const uploadData = await uploadResponse.json();

      // Then assign it to the selected stop
      const assignResponse = await fetch(`/api/admin/documents/${uploadData.document.id}/assign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stopIds: [selectedStopId],
        }),
      });

      if (!assignResponse.ok) {
        throw new Error("Failed to assign document to stop");
      }

      // Reset form and close modal
      setUploadForm({
        title: "",
        description: "",
        type: "OTHER",
        file: null,
      });
      setShowUploadModal(false);
      setSelectedStopId(null);

      // Refresh routes list
      await fetchTodaysRoutes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (documentId: string, stopId: string) => {
    if (!confirm("Are you sure you want to remove this document from the stop?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/documents/${documentId}/assign`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stopIds: [stopId],
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove document from stop");
      }

      await fetchTodaysRoutes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const toggleRouteExpansion = (routeId: string) => {
    const newExpanded = new Set(expandedRoutes);
    if (newExpanded.has(routeId)) {
      newExpanded.delete(routeId);
    } else {
      newExpanded.add(routeId);
    }
    setExpandedRoutes(newExpanded);
  };

  const toggleDriverExpansion = (driverName: string) => {
    const newExpanded = new Set(expandedDrivers);
    if (newExpanded.has(driverName)) {
      newExpanded.delete(driverName);
    } else {
      newExpanded.add(driverName);
    }
    setExpandedDrivers(newExpanded);
  };

  // Group stops by driver
  const groupStopsByDriver = () => {
    const driverGroups: { [key: string]: any[] } = {};

    routes.forEach(route => {
      route.stops.forEach(stop => {
        const driverName = stop.driverNameFromUpload || "Unassigned";
        if (!driverGroups[driverName]) {
          driverGroups[driverName] = [];
        }
        driverGroups[driverName].push({
          ...stop,
          route: {
            id: route.id,
            routeNumber: route.routeNumber,
            date: route.date,
            status: route.status
          }
        });
      });
    });

    return driverGroups;
  };

  const openUploadModal = (stopId: string) => {
    setSelectedStopId(stopId);
    setShowUploadModal(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return <AuthLoadingSpinner message="Loading documents..." />;
  }

  // Only show access denied if auth is complete and user is not authenticated
  if (!authLoading && !isAuthenticated) {
    return <AccessDenied title="Access Denied" message="Admin access required" />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setGroupBy("route")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                groupBy === "route"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              By Route
            </button>
            <button
              onClick={() => setGroupBy("driver")}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                groupBy === "driver"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              By Driver
            </button>
          </div>
          <div className="text-sm text-gray-600">
            Manage documents for today's routes and stops
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {groupBy === "route" ? (
          // Group by Route
          routes.map((route) => (
          <div key={route.id} className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Route Header */}
            <div
              className="bg-gray-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleRouteExpansion(route.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        expandedRoutes.has(route.id) ? "rotate-90" : ""
                      }`}
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
                    <h3 className="ml-2 text-lg font-medium text-gray-900">
                      Route {route.routeNumber}
                    </h3>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    route.status === "COMPLETED"
                      ? "bg-green-100 text-green-800"
                      : route.status === "IN_PROGRESS"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {route.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {route.stops.length} stops
                </div>
              </div>
            </div>

            {/* Stops List */}
            {expandedRoutes.has(route.id) && (
              <div className="divide-y divide-gray-200">
                {route.stops.map((stop) => (
                  <div key={stop.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                              {stop.sequence}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {stop.customerNameFromUpload}
                            </p>
                            <p className="text-sm text-gray-500">
                              Driver: {stop.driverNameFromUpload}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              stop.status === "COMPLETED"
                                ? "bg-green-100 text-green-800"
                                : stop.status === "ON_THE_WAY" || stop.status === "ARRIVED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {stop.status}
                            </span>
                          </div>
                        </div>

                        {/* Documents for this stop */}
                        {stop.stopDocuments.length > 0 && (
                          <div className="mt-3 ml-12">
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                              Documents ({stop.stopDocuments.length})
                            </h4>
                            <div className="space-y-2">
                              {stop.stopDocuments.map((stopDoc) => (
                                <div key={stopDoc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                      <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {stopDoc.document.title}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {stopDoc.document.type.replace("_", " ")} • {formatFileSize(stopDoc.document.fileSize)}
                                        {stopDoc.isPrinted && " • Printed"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <a
                                      href={stopDoc.document.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-900 text-sm"
                                    >
                                      View
                                    </a>
                                    <button
                                      onClick={() => deleteDocument(stopDoc.document.id, stop.id)}
                                      className="text-red-600 hover:text-red-900 text-sm"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 ml-4">
                        <button
                          onClick={() => openUploadModal(stop.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          Add Document
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          ))
        ) : (
          // Group by Driver
          Object.entries(groupStopsByDriver()).map(([driverName, stops]) => (
            <div key={driverName} className="bg-white shadow-md rounded-lg overflow-hidden">
              {/* Driver Header */}
              <div
                className="bg-gray-50 px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleDriverExpansion(driverName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          expandedDrivers.has(driverName) ? "rotate-90" : ""
                        }`}
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
                      <h3 className="ml-2 text-lg font-medium text-gray-900">
                        {driverName}
                      </h3>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Driver
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {stops.length} stop{stops.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Stops List for Driver */}
              {expandedDrivers.has(driverName) && (
                <div className="divide-y divide-gray-200">
                  {stops.map((stop) => (
                    <div key={stop.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                                {stop.sequence}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {stop.customerNameFromUpload}
                              </p>
                              <p className="text-sm text-gray-500">
                                Route {stop.route.routeNumber} • {new Date(stop.route.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                stop.status === "COMPLETED"
                                  ? "bg-green-100 text-green-800"
                                  : stop.status === "ON_THE_WAY" || stop.status === "ARRIVED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}>
                                {stop.status}
                              </span>
                            </div>
                          </div>

                          {/* Documents for this stop */}
                          {stop.stopDocuments.length > 0 && (
                            <div className="mt-3 ml-12">
                              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                Documents ({stop.stopDocuments.length})
                              </h4>
                              <div className="space-y-2">
                                {stop.stopDocuments.map((stopDoc) => (
                                  <div key={stopDoc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {stopDoc.document.title}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {stopDoc.document.type.replace("_", " ")} • {formatFileSize(stopDoc.document.fileSize)}
                                          {stopDoc.isPrinted && " • Printed"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <a
                                        href={stopDoc.document.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-900 text-sm"
                                      >
                                        View
                                      </a>
                                      <button
                                        onClick={() => deleteDocument(stopDoc.document.id, stop.id)}
                                        className="text-red-600 hover:text-red-900 text-sm"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex-shrink-0 ml-4">
                          <button
                            onClick={() => openUploadModal(stop.id)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            Add Document
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {((groupBy === "route" && routes.length === 0) || (groupBy === "driver" && Object.keys(groupStopsByDriver()).length === 0)) && !loading && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No routes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No routes are scheduled for today.
            </p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Upload Document
              </h3>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, title: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, description: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={uploadForm.type}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {documentTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File *
                  </label>
                  <input
                    type="file"
                    onChange={(e) =>
                      setUploadForm({
                        ...uploadForm,
                        file: e.target.files?.[0] || null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported: PDF, Word, Excel, Images (Max 10MB)
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadForm({
                        title: "",
                        description: "",
                        type: "OTHER",
                        file: null,
                      });
                      setError("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                    disabled={uploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
