"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDriverAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

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
  isActive: boolean;
  createdAt: string;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
}

export default function DriverDocumentsPage() {
  const { token, isLoading: authLoading, isAuthenticated } = useDriverAuth();
  const router = useRouter();

  const [documents, setDocuments] = useState<SystemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = [
    { value: "ALL", label: "All Documents" },
    { value: "SAFETY", label: "Safety" },
    { value: "COMPLIANCE", label: "Compliance" },
    { value: "PROCEDURE", label: "Procedures" },
    { value: "POLICY", label: "Policies" },
    { value: "TRAINING", label: "Training" },
    { value: "REFERENCE", label: "Reference" },
  ];

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchDocuments();
    }
  }, [token, isAuthenticated, selectedCategory]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let url = "/api/driver/system-documents?";
      
      if (selectedCategory !== "ALL") {
        url += `category=${selectedCategory}`;
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
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Filter documents based on search query
  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      doc.title.toLowerCase().includes(query) ||
      doc.description?.toLowerCase().includes(query) ||
      doc.fileName.toLowerCase().includes(query) ||
      doc.category.toLowerCase().includes(query)
    );
  });

  const handleAcknowledge = async (documentId: string) => {
    try {
      setAcknowledging(documentId);
      setError("");

      const response = await fetch("/api/driver/system-documents/acknowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to acknowledge document");
      }

      // Refresh documents list
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge document");
    } finally {
      setAcknowledging(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      SAFETY: "🛡️",
      COMPLIANCE: "📋",
      PROCEDURE: "📝",
      POLICY: "📜",
      TRAINING: "🎓",
      REFERENCE: "📚",
    };
    return icons[category] || "📄";
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      SAFETY: "bg-red-50 border-red-200",
      COMPLIANCE: "bg-yellow-50 border-yellow-200",
      PROCEDURE: "bg-blue-50 border-blue-200",
      POLICY: "bg-purple-50 border-purple-200",
      TRAINING: "bg-green-50 border-green-200",
      REFERENCE: "bg-gray-50 border-gray-200",
    };
    return colors[category] || "bg-gray-50 border-gray-200";
  };

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  const requiredDocuments = filteredDocuments.filter((doc) => doc.isRequired);
  const referenceDocuments = filteredDocuments.filter((doc) => !doc.isRequired);
  const unacknowledgedCount = documents.filter((doc) => doc.isRequired && !doc.isAcknowledged).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 mobile-spacing">
      {/* Header */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-black mobile-heading">Document Library</h1>
            <p className="text-sm text-gray-600 mt-1 mobile-text">
              Company policies, procedures, and compliance documents
            </p>
          </div>
          {unacknowledgedCount > 0 && (
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              {unacknowledgedCount} unread
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-md p-4 mobile-card space-y-4">
          {/* Search Bar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Documents
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by title, description, or file name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
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
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Results Count */}
          {searchQuery && (
            <div className="text-sm text-gray-600">
              Found {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""} matching "{searchQuery}"
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading documents...</p>
          </div>
        ) : (
          <>
            {/* Required Documents Section */}
            {requiredDocuments.length > 0 && (
              <div>
                <div className="flex items-center mb-3">
                  <h2 className="text-lg font-bold text-gray-900">Required Documents</h2>
                  {unacknowledgedCount > 0 && (
                    <span className="ml-2 bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {unacknowledgedCount} pending
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {requiredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`bg-white rounded-xl border-2 ${
                        doc.isAcknowledged
                          ? "border-green-200"
                          : "border-red-200 shadow-md"
                      } p-4 mobile-card`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{getCategoryIcon(doc.category)}</span>
                            <div>
                              <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                              <p className="text-xs text-gray-500">
                                {doc.category} • {formatFileSize(doc.fileSize)}
                              </p>
                            </div>
                          </div>
                          {doc.description && (
                            <p className="text-sm text-gray-600 mb-3">{doc.description}</p>
                          )}
                          {doc.isAcknowledged && doc.acknowledgedAt && (
                            <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded inline-flex">
                              <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Acknowledged on{" "}
                              {new Date(doc.acknowledgedAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <a
                          href={doc.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-blue-600 text-white text-center px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium touch-manipulation tap-target"
                        >
                          View Document
                        </a>
                        {!doc.isAcknowledged && (
                          <button
                            onClick={() => handleAcknowledge(doc.id)}
                            disabled={acknowledging === doc.id}
                            className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 touch-manipulation tap-target"
                          >
                            {acknowledging === doc.id ? "Acknowledging..." : "I Have Read This"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reference Documents Section */}
            {referenceDocuments.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">
                  Reference Documents
                </h2>
                <div className="space-y-3">
                  {referenceDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={`bg-white rounded-xl border ${getCategoryColor(
                        doc.category
                      )} p-4 mobile-card`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">{getCategoryIcon(doc.category)}</span>
                            <div>
                              <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                              <p className="text-xs text-gray-500">
                                {doc.category} • {formatFileSize(doc.fileSize)}
                              </p>
                            </div>
                          </div>
                          {doc.description && (
                            <p className="text-sm text-gray-600 mb-3">{doc.description}</p>
                          )}
                        </div>
                      </div>
                      <a
                        href={doc.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-gray-800 text-white text-center px-4 py-3 rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium touch-manipulation tap-target"
                      >
                        View Document
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {documents.length === 0 && (
              <div className="bg-white rounded-xl shadow-md p-12 text-center mobile-card">
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
                <h3 className="mt-2 text-sm font-medium text-gray-900">No documents available</h3>
                <p className="mt-1 text-sm text-gray-500 mobile-text">
                  Check back later for company documents and policies.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

