"use client";

import { useState, useEffect } from "react";

interface UnacknowledgedDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  documentType: string;
  filePath: string;
  fileName: string;
  fileSize: number;
}

interface DocumentReviewStepProps {
  onComplete: () => void;
  token: string;
  routeId: string;
}

export default function DocumentReviewStep({
  onComplete,
  token,
  routeId,
}: DocumentReviewStepProps) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<UnacknowledgedDocument[]>([]);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUnacknowledgedDocuments();
  }, [routeId]);

  const fetchUnacknowledgedDocuments = async () => {
    try {
      const response = await fetch(`/api/driver/system-documents/acknowledge?routeId=${routeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents || []);

      // If no unacknowledged documents, automatically proceed
      if (!data.documents || data.documents.length === 0) {
        onComplete();
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError("Failed to load required documents");
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (documentId: string) => {
    setAcknowledging(documentId);
    setError("");

    try {
      const response = await fetch("/api/driver/system-documents/acknowledge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId, routeId }),
      });

      if (!response.ok) {
        throw new Error("Failed to acknowledge document");
      }

      // Remove the acknowledged document from the list
      const updatedDocuments = documents.filter((doc) => doc.id !== documentId);
      setDocuments(updatedDocuments);

      // If all documents are acknowledged, proceed to safety checklist
      if (updatedDocuments.length === 0) {
        setTimeout(() => {
          onComplete();
        }, 500);
      }
    } catch (err) {
      console.error("Error acknowledging document:", err);
      setError("Failed to acknowledge document. Please try again.");
    } finally {
      setAcknowledging(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      SAFETY: "🛡️",
      COMPLIANCE: "📋",
      PROCEDURE: "📝",
      POLICY: "📜",
      TRAINING: "🎓",
      REFERENCE: "📚",
    };
    return icons[category] || "📄";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Checking required documents...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return null; // Component will auto-proceed
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="border-l-4 border-red-500 pl-4 py-3 mb-6 bg-red-50 rounded-r-lg">
        <div className="flex items-center mb-2">
          <span className="text-lg mr-2">⚠️</span>
          <h3 className="text-sm font-medium text-red-800">
            Required Documents - Action Needed
          </h3>
        </div>
        <p className="text-sm text-red-700">
          You must read and acknowledge the following {documents.length}{" "}
          document{documents.length !== 1 ? "s" : ""} before starting your route.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="border-2 border-red-300 bg-red-50 rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-3">
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

            <div className="flex gap-2">
              <a
                href={doc.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-gray-800 text-white text-center px-4 py-2 rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium"
              >
                📄 View Document
              </a>
              <button
                onClick={() => handleAcknowledge(doc.id)}
                disabled={acknowledging === doc.id}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acknowledging === doc.id ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Acknowledging...
                  </span>
                ) : (
                  "✓ I Have Read This"
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          <strong>Note:</strong> You must acknowledge all required documents before
          proceeding to the safety checklist.
        </p>
      </div>
    </div>
  );
}

