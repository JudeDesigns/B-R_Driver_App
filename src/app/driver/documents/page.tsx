"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

interface StopDocument {
  id: string;
  isPrinted: boolean;
  printedAt?: string;
  document: Document;
  stop: {
    id: string;
    sequence: number;
    customerNameFromUpload: string;
    route: {
      id: string;
      routeNumber: string;
      date: string;
    };
  };
}

interface RouteWithDocuments {
  id: string;
  sequence: number;
  customerNameFromUpload: string;
  route: {
    id: string;
    routeNumber: string;
    date: string;
  };
  stopDocuments: StopDocument[];
}

export default function DriverDocumentsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [stops, setStops] = useState<RouteWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "printed">("all");

  useEffect(() => {
    // Check authentication
    const checkAuth = () => {
      try {
        const sessionStorageToken = sessionStorage.getItem("token");
        const localStorageToken = localStorage.getItem("token");
        const storedToken = sessionStorageToken || localStorageToken;

        const sessionStorageRole = sessionStorage.getItem("userRole");
        const localStorageRole = localStorage.getItem("userRole");
        const userRole = sessionStorageRole || localStorageRole;

        if (!storedToken || userRole !== "DRIVER") {
          router.push("/login");
        } else {
          setToken(storedToken);
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (token) {
      fetchDriverDocuments();
    }
  }, [token]);

  const fetchDriverDocuments = async () => {
    try {
      const response = await fetch("/api/driver/documents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setStops(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const markAsPrinted = async (stopDocumentId: string) => {
    try {
      const response = await fetch("/api/driver/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stopDocumentId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark document as printed");
      }

      // Refresh the documents list
      await fetchDriverDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "INVOICE":
        return "📄";
      case "CREDIT_MEMO":
        return "💳";
      case "DELIVERY_RECEIPT":
        return "📋";
      case "RETURN_FORM":
        return "↩️";
      default:
        return "📎";
    }
  };

  const filteredStops = stops.filter((stop) => {
    if (filter === "all") return stop.stopDocuments.length > 0;
    if (filter === "pending") return stop.stopDocuments.some(doc => !doc.isPrinted);
    if (filter === "printed") return stop.stopDocuments.some(doc => doc.isPrinted);
    return true;
  });

  const totalDocuments = stops.reduce((total, stop) => total + stop.stopDocuments.length, 0);
  const printedDocuments = stops.reduce((total, stop) =>
    total + stop.stopDocuments.filter(doc => doc.isPrinted).length, 0
  );
  const pendingDocuments = totalDocuments - printedDocuments;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 pb-24">
      {/* Header */}
      <div className="bg-white shadow-md rounded-lg mb-4 sm:mb-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Documents to Print</h1>
          <button
            onClick={() => router.push("/driver")}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base self-start sm:self-auto"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{totalDocuments}</div>
            <div className="text-xs sm:text-sm text-blue-800">Total</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-orange-600">{pendingDocuments}</div>
            <div className="text-xs sm:text-sm text-orange-800">Pending</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{printedDocuments}</div>
            <div className="text-xs sm:text-sm text-green-800">Printed</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400"
            }`}
          >
            All Stops
          </button>
          <button
            onClick={() => setFilter("pending")}
            className={`flex-1 px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
              filter === "pending"
                ? "bg-orange-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400"
            }`}
          >
            Need Printing
          </button>
          <button
            onClick={() => setFilter("printed")}
            className={`flex-1 px-3 sm:px-4 py-2 sm:py-2 rounded-lg text-sm font-medium transition-colors touch-manipulation ${
              filter === "printed"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400"
            }`}
          >
            Printed
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Documents List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredStops.map((stop) => (
          <div key={stop.id} className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Stop Header */}
            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <div className="flex items-center space-x-3 sm:space-x-4">
                  <span className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                    {stop.sequence}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 truncate">
                      {stop.customerNameFromUpload}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Route {stop.route.routeNumber}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 self-start sm:self-auto">
                  {stop.stopDocuments.length} document{stop.stopDocuments.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Documents */}
            <div className="divide-y divide-gray-200">
              {stop.stopDocuments.map((stopDoc) => (
                <div key={stopDoc.id} className="px-4 sm:px-6 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:justify-between">
                    <div className="flex items-start space-x-3 sm:space-x-4 flex-1">
                      <div className="text-xl sm:text-2xl flex-shrink-0">
                        {getDocumentIcon(stopDoc.document.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {stopDoc.document.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-500">
                          {stopDoc.document.type.replace("_", " ")} • {formatFileSize(stopDoc.document.fileSize)}
                        </p>
                        {stopDoc.document.description && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                            {stopDoc.document.description}
                          </p>
                        )}
                        {stopDoc.isPrinted && (
                          <div className="flex items-center text-green-600 mt-2 sm:hidden">
                            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-xs">Printed</span>
                          </div>
                        )}
                      </div>
                      {stopDoc.isPrinted && (
                        <div className="hidden sm:flex items-center text-green-600">
                          <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm">Printed</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 sm:flex-shrink-0">
                      <a
                        href={stopDoc.document.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors text-center touch-manipulation"
                      >
                        📄 View & Print
                      </a>
                      {!stopDoc.isPrinted && (
                        <button
                          onClick={() => markAsPrinted(stopDoc.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 active:bg-green-800 transition-colors touch-manipulation"
                        >
                          ✓ Mark Printed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredStops.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {filter === "all" ? "No documents found" :
               filter === "pending" ? "No documents need printing" :
               "No documents have been printed yet"}
            </h3>
            <p className="text-gray-500">
              {filter === "all" ? "No documents have been assigned to your stops." :
               filter === "pending" ? "All documents have been printed." :
               "Print some documents to see them here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
