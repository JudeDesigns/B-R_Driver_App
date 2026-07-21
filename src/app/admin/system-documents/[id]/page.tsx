"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

interface Acknowledgment {
  id: string;
  documentId: string;
  driverId: string;
  acknowledgedAt: string;
  documentVersion: number;
  signatureImageUrl: string | null;
  signedPdfUrl: string | null;
  isValid: boolean;
  invalidatedAt: string | null;
  invalidatedBy: string | null;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

interface SystemDocumentDetail {
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
  version: number;
  createdAt: string;
  uploader: {
    id: string;
    username: string;
    fullName: string | null;
  };
  acknowledgments: Acknowledgment[];
}

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

export default function SystemDocumentDetailPage() {
  const { token, isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params?.id as string;

  const [document, setDocument] = useState<SystemDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);

  const [invalidatingId, setInvalidatingId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "",
    documentType: "",
    isRequired: false,
    requiresSignature: false,
    isActive: true,
  });

  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/system-documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch document");
      }

      const data = await response.json();
      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [documentId, token]);

  useEffect(() => {
    if (token && isAuthenticated && documentId) {
      fetchDocument();
    }
  }, [token, isAuthenticated, documentId, fetchDocument]);

  const handleReplaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReplaceFile(e.target.files[0]);
    }
  };

  const handleReplaceFile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replaceFile) {
      setError("Please select a file to upload");
      return;
    }

    try {
      setReplacing(true);
      setError("");
      setSuccessMessage("");

      const formData = new FormData();
      formData.append("file", replaceFile);

      const response = await fetch(`/api/admin/system-documents/${documentId}/replace-file`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to replace file");
      }

      const data = await response.json();
      setReplaceFile(null);
      await fetchDocument();
      setSuccessMessage(
        `New version (v${data.document.version}) uploaded. Drivers will need to re-acknowledge/re-sign.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to replace file");
    } finally {
      setReplacing(false);
    }
  };

  const startEditing = () => {
    if (!document) return;
    setEditForm({
      title: document.title,
      description: document.description || "",
      category: document.category,
      documentType: document.documentType,
      isRequired: document.isRequired,
      requiresSignature: document.requiresSignature,
      isActive: document.isActive,
    });
    setError("");
    setSuccessMessage("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    if (!editForm.title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(`/api/admin/system-documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          category: editForm.category,
          documentType: editForm.documentType,
          isRequired: editForm.isRequired,
          requiresSignature: editForm.requiresSignature,
          isActive: editForm.isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update document");
      }

      await fetchDocument();
      setIsEditing(false);
      setSuccessMessage("Document updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update document");
    } finally {
      setSaving(false);
    }
  };

  const handleInvalidate = async (ack: Acknowledgment) => {
    const driverName = ack.driver.fullName || ack.driver.username;
    const confirmMessage = document?.requiresSignature
      ? `Reset ${driverName}'s signature for this document? They will need to sign again.`
      : `Reset ${driverName}'s acknowledgment for this document? They will need to acknowledge it again.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setInvalidatingId(ack.id);
      setError("");

      const response = await fetch(
        `/api/admin/system-documents/${documentId}/acknowledgments/${ack.id}/invalidate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reset signature");
      }

      await fetchDocument();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset signature");
    } finally {
      setInvalidatingId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString();
  };

  const categoryLabel = (value: string) =>
    categories.find((c) => c.value === value)?.label || value;

  const documentTypeLabel = (value: string) =>
    documentTypes.find((t) => t.value === value)?.label || value;

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/admin/system-documents"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Documents
          </Link>
        </div>

        {/* Error / Success Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading document...</p>
          </div>
        ) : !document ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <p className="text-gray-600">Document not found.</p>
          </div>
        ) : (
          <>
            {/* Document Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              {!isEditing ? (
                <>
                  <div className="flex justify-between items-start gap-4 mb-5">
                    <div className="min-w-0">
                      <h1 className="text-xl font-semibold text-gray-900 truncate">
                        {document.title}
                      </h1>
                      <p className="text-gray-500 text-sm mt-1">
                        {document.description || "No description"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {document.isRequired && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-900 text-white">
                          Required
                        </span>
                      )}
                      {document.requiresSignature && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-gray-300 text-gray-700">
                          Signature required
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          document.isActive
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}
                      >
                        {document.isActive ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        onClick={startEditing}
                        className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 text-sm">
                    <div className="min-w-0">
                      <dt className="text-gray-500">Category</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">
                        {categoryLabel(document.category)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-gray-500">Document Type</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">
                        {documentTypeLabel(document.documentType)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-gray-500">Version</dt>
                      <dd className="font-medium text-gray-900 mt-0.5">v{document.version}</dd>
                    </div>
                    <div className="min-w-0 col-span-2 md:col-span-1">
                      <dt className="text-gray-500">File</dt>
                      <dd
                        className="font-medium text-gray-900 mt-0.5 truncate"
                        title={document.fileName}
                      >
                        {document.fileName}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5">
                    <a
                      href={document.filePath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-700 hover:text-gray-900 underline underline-offset-2"
                    >
                      View document
                    </a>
                  </div>
                </>
              ) : (
                <form onSubmit={handleSaveEdit} className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Edit Document</h2>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({ ...editForm, description: e.target.value })
                      }
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm({ ...editForm, category: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      >
                        {categories.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Document Type
                      </label>
                      <select
                        value={editForm.documentType}
                        onChange={(e) =>
                          setEditForm({ ...editForm, documentType: e.target.value })
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      >
                        {documentTypes.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6 pt-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editForm.isRequired}
                        onChange={(e) =>
                          setEditForm({ ...editForm, isRequired: e.target.checked })
                        }
                        className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                      />
                      Required (blocks drivers until satisfied)
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editForm.requiresSignature}
                        onChange={(e) =>
                          setEditForm({ ...editForm, requiresSignature: e.target.checked })
                        }
                        className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                      />
                      Requires signature
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(e) =>
                          setEditForm({ ...editForm, isActive: e.target.checked })
                        }
                        className="h-4 w-4 text-gray-900 border-gray-300 rounded"
                      />
                      Active
                    </label>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Replace File */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Replace File</h2>
              <p className="text-sm text-gray-500 mb-4">
                Uploading a new file will bump the document version. Drivers who already
                acknowledged/signed an older version will be flagged as needing to
                re-acknowledge/re-sign.
              </p>
              <form onSubmit={handleReplaceFile} className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  onChange={handleReplaceFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={replacing}
                  className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {replacing ? "Uploading..." : "Upload New Version"}
                </button>
              </form>
            </div>

            {/* Acknowledgments */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-base font-semibold text-gray-900">
                  Acknowledgments ({document.acknowledgments.length})
                </h2>
              </div>

              {document.acknowledgments.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-sm">
                  No acknowledgments yet.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Driver
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acknowledged At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Version
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Signature
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {document.acknowledgments.map((ack) => {
                      const driverName = ack.driver.fullName || ack.driver.username;
                      const isCurrent =
                        ack.isValid && ack.documentVersion === document.version;
                      const isStale =
                        ack.isValid && ack.documentVersion !== document.version;

                      return (
                        <tr key={ack.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {driverName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(ack.acknowledgedAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            v{ack.documentVersion}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isCurrent && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                Current
                              </span>
                            )}
                            {isStale && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                Needs re-sign (v{ack.documentVersion})
                              </span>
                            )}
                            {!ack.isValid && (
                              <div>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                  Invalidated
                                </span>
                                {ack.invalidatedAt && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    Reset by admin on {formatDate(ack.invalidatedAt)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              {ack.signatureImageUrl && (
                                <img
                                  src={ack.signatureImageUrl}
                                  alt={`${driverName} signature`}
                                  width={120}
                                  height={40}
                                  className="border border-gray-200 rounded bg-white"
                                  style={{ width: 120, height: 40, objectFit: "contain" }}
                                />
                              )}
                              {ack.signedPdfUrl && (
                                <a
                                  href={ack.signedPdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-700 hover:text-gray-900 underline underline-offset-2 text-xs font-medium"
                                >
                                  View Signed PDF
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {isCurrent && (
                              <button
                                onClick={() => handleInvalidate(ack)}
                                disabled={invalidatingId === ack.id}
                                className="text-red-600 hover:text-red-800 disabled:opacity-50"
                              >
                                {invalidatingId === ack.id
                                  ? "Resetting..."
                                  : document.requiresSignature
                                  ? "Reset Signature"
                                  : "Reset Acknowledgment"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
