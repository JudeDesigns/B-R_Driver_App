"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

interface SystemDocument {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  category: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  isRequired: boolean;
  requiresSignature: boolean;
  isActive: boolean;
  createdAt: string;
  uploader: {
    id: string;
    username: string;
    fullName: string | null;
  };
  _count: {
    acknowledgments: number;
  };
}

export default function SystemDocumentsPage() {
  const { token, userRole, isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<SystemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [filterRequired, setFilterRequired] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    documentType: "SAFETY_INSTRUCTIONS",
    category: "SAFETY",
    isRequired: false,
    requiresSignature: false,
    file: null as File | null,
  });

  const documentTypes = [
    { value: "DAILY_SAFETY_DECLARATION", label: "Daily Safety Declaration" },
    { value: "SAFETY_INSTRUCTIONS", label: "Safety Instructions" },
    { value: "COMPANY_POLICY", label: "Company Policy" },
    { value: "FUELING_PROCEDURE", label: "Fueling Procedure" },
    { value: "CUSTOMER_SERVICE_GUIDE", label: "Customer Service Guide" },
    { value: "BREAK_COMPLIANCE", label: "Break Compliance" },
    { value: "CALIFORNIA_LAW", label: "California Law" },
    { value: "VEHICLE_MAINTENANCE", label: "Vehicle Maintenance" },
    { value: "EMERGENCY_PROCEDURES", label: "Emergency Procedures" },
    { value: "OTHER", label: "Other" },
  ];

  const categories = [
    { value: "SAFETY", label: "Safety" },
    { value: "COMPLIANCE", label: "Compliance" },
    { value: "PROCEDURE", label: "Procedure" },
    { value: "POLICY", label: "Policy" },
    { value: "TRAINING", label: "Training" },
    { value: "REFERENCE", label: "Reference" },
  ];

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchDocuments();
    }
  }, [token, isAuthenticated, filterCategory, filterRequired]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let url = "/api/admin/system-documents?";
      
      if (filterCategory !== "ALL") {
        url += `category=${filterCategory}&`;
      }
      
      if (filterRequired !== "ALL") {
        url += `isRequired=${filterRequired === "REQUIRED"}&`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm({ ...uploadForm, file: e.target.files[0] });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadForm.file || !uploadForm.title) {
      setError("Please provide a title and select a file");
      return;
    }

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("title", uploadForm.title);
      formData.append("description", uploadForm.description);
      formData.append("documentType", uploadForm.documentType);
      formData.append("category", uploadForm.category);
      formData.append("isRequired", uploadForm.isRequired.toString());
      formData.append("requiresSignature", uploadForm.requiresSignature.toString());

      const response = await fetch("/api/admin/system-documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      // Reset form and close modal
      setUploadForm({
        title: "",
        description: "",
        documentType: "SAFETY_INSTRUCTIONS",
        category: "SAFETY",
        isRequired: false,
        requiresSignature: false,
        file: null,
      });
      setShowUploadModal(false);

      // Refresh documents list
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (documentId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/system-documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update document");
      }

      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update document");
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/system-documents/${documentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const getCategoryLabel = (category: string) =>
    categories.find((c) => c.value === category)?.label || category;

  // Filter documents based on search query
  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query) ||
      doc.fileName.toLowerCase().includes(query) ||
      doc.category.toLowerCase().includes(query) ||
      doc.documentType.toLowerCase().includes(query)
    );
  });

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">System Documents</h1>
          <p className="text-gray-600 mt-2">
            Manage driver compliance documents, procedures, and policies
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search documents by title, description, or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
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
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              {/* Required Filter */}
              <select
                value={filterRequired}
                onChange={(e) => setFilterRequired(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2"
              >
                <option value="ALL">All Documents</option>
                <option value="REQUIRED">Required Only</option>
                <option value="OPTIONAL">Optional Only</option>
              </select>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              + Upload Document
            </button>
          </div>

          {/* Search Results Count */}
          {searchQuery && (
            <div className="text-sm text-gray-600">
              Found {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} matching "{searchQuery}"
            </div>
          )}
        </div>

        {/* Documents List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by uploading a system document.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acknowledgments
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-5 align-top">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 h-9 w-9 flex items-center justify-center bg-gray-100 rounded-lg">
                          <svg
                            className="h-5 w-5 text-gray-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {doc.title}
                            </span>
                            {doc.isRequired && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-900 text-white">
                                Required
                              </span>
                            )}
                            {doc.requiresSignature && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-gray-300 text-gray-600">
                                Signature required
                              </span>
                            )}
                          </div>
                          {doc.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {doc.description}
                            </div>
                          )}
                          <div
                            className="text-xs text-gray-400 truncate max-w-xs"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top whitespace-nowrap text-sm text-gray-600">
                      {getCategoryLabel(doc.category)}
                    </td>
                    <td className="px-6 py-5 align-top whitespace-nowrap text-sm text-gray-500">
                      {documentTypes.find((t) => t.value === doc.documentType)?.label ||
                        doc.documentType}
                    </td>
                    <td className="px-6 py-5 align-top whitespace-nowrap text-sm text-gray-500">
                      {doc._count.acknowledgments} driver(s)
                    </td>
                    <td className="px-6 py-5 align-top whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(doc.id, doc.isActive)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          doc.isActive
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {doc.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-5 align-top whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-4">
                        <button
                          onClick={() => router.push(`/admin/system-documents/${doc.id}`)}
                          className="text-gray-700 hover:text-gray-900"
                        >
                          Manage
                        </button>
                        <a
                          href={doc.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-700 hover:text-gray-900"
                        >
                          View
                        </a>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Upload System Document</h2>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, title: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="e.g., Safety Procedures 2024"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, description: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      rows={3}
                      placeholder="Brief description of the document"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, category: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    >
                      {categories.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Document Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Document Type *
                    </label>
                    <select
                      value={uploadForm.documentType}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, documentType: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    >
                      {documentTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Is Required */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isRequired"
                      checked={uploadForm.isRequired}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, isRequired: e.target.checked })
                      }
                      className="h-4 w-4 text-black border-gray-300 rounded"
                    />
                    <label htmlFor="isRequired" className="ml-2 text-sm text-gray-700">
                      Required (drivers must acknowledge before starting their day)
                    </label>
                  </div>

                  {/* Requires Signature */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="requiresSignature"
                      checked={uploadForm.requiresSignature}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, requiresSignature: e.target.checked })
                      }
                      className="h-4 w-4 text-black border-gray-300 rounded"
                    />
                    <label htmlFor="requiresSignature" className="ml-2 text-sm text-gray-700">
                      Requires Signature (drivers must draw a signature to acknowledge, not just click a button)
                    </label>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File *
                    </label>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Accepted formats: PDF, Word documents, Images (JPG, PNG)
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="flex-1 bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {uploading ? "Uploading..." : "Upload Document"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

