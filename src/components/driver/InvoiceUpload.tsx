"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../ui/LoadingSpinner";

interface InvoiceUploadProps {
  stopId: string;
  onUploadSuccess: (pdfUrl: string) => void;
  existingPdfUrl?: string | null; // Allow null to match the type from the database
  markAsCompleted?: boolean;
  currentStopStatus?: string;
}

export default function InvoiceUpload({
  stopId,
  onUploadSuccess,
  existingPdfUrl,
  markAsCompleted = false, // Changed default to false
  currentStopStatus,
}: InvoiceUploadProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [stopStatus, setStopStatus] = useState<string | null>(
    currentStopStatus || null
  );
  const [pdfUrl, setPdfUrl] = useState<string | null>(existingPdfUrl);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only show confirmation dialog if there are existing images
    if (existingPdfUrl || pdfUrl) {
      setPendingFile(file);
      setShowConfirmDialog(true);
    } else {
      // No existing images, upload directly
      uploadFile(file);
    }
  };

  const handleConfirmUpload = () => {
    setShowConfirmDialog(false);
    if (pendingFile) {
      uploadFile(pendingFile);
      setPendingFile(null);
    }
  };

  const handleCancelUpload = () => {
    setShowConfirmDialog(false);
    setPendingFile(null);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Only show confirmation dialog if there are existing images
    if (existingPdfUrl || pdfUrl) {
      setPendingFile(file);
      setShowConfirmDialog(true);
    } else {
      // No existing images, upload directly
      uploadFile(file);
    }
  };

  // Function to mark delivery as completed
  const markDeliveryAsCompleted = async (invoicePdfUrl: string) => {
    setIsMarkingCompleted(true);
    try {
      // Get the token to ensure we have the latest
      let completeToken = "";
      if (typeof window !== "undefined") {
        // Check both sessionStorage (for drivers) and localStorage (for admins)
        completeToken =
          sessionStorage.getItem("token") ||
          localStorage.getItem("token") ||
          "";
      }

      const completeResponse = await fetch(`/api/driver/stops/${stopId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${completeToken}`,
        },
        body: JSON.stringify({
          status: "COMPLETED",
          completionTime: new Date().toISOString(),
          signedInvoicePdfUrl: invoicePdfUrl,
        }),
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json().catch(() => null);
        console.warn("Failed to mark stop as completed:", errorData?.message);
        throw new Error(
          errorData?.message || "Failed to mark delivery as completed"
        );
      }

      // Show success message and redirect to stops page
      console.log("Delivery completed successfully, redirecting to stops page...");

      // Small delay to show success state, then redirect
      setTimeout(() => {
        // Check if token is still valid before redirecting
        const currentToken = sessionStorage.getItem("token") || localStorage.getItem("token");
        if (currentToken) {
          router.push("/driver/stops");
        } else {
          // Token expired, redirect to login
          console.log("Token expired during delivery, redirecting to login");
          router.push("/login");
        }
      }, 1500);
    } catch (completeErr) {
      console.error("Error marking stop as completed:", completeErr);
      setError(
        completeErr instanceof Error
          ? completeErr.message
          : "Failed to mark delivery as completed"
      );
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  // Update pdfUrl when existingPdfUrl changes
  useEffect(() => {
    setPdfUrl(existingPdfUrl);
  }, [existingPdfUrl]);

  // Update stopStatus when currentStopStatus changes
  useEffect(() => {
    if (currentStopStatus) {
      console.log("Using currentStopStatus from props:", currentStopStatus);
      setStopStatus(currentStopStatus);
    }
  }, [currentStopStatus]);

  // Fetch stop status to enforce proper sequence
  useEffect(() => {
    const fetchStopStatus = async () => {
      try {
        // Check both sessionStorage and localStorage
        const token =
          sessionStorage.getItem("token") ||
          localStorage.getItem("token") ||
          "";

        if (!token) return;

        const response = await fetch(`/api/driver/stops/${stopId}/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Fetched stop status:", data.status);
          setStopStatus(data.status);
        }
      } catch (error) {
        console.error("Error fetching stop status:", error);
      }
    };

    fetchStopStatus();

    // Set an interval to periodically refresh the status
    const intervalId = setInterval(fetchStopStatus, 5000); // Refresh every 5 seconds

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [stopId]);

  const uploadFile = async (file: File) => {
    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPEG, PNG, etc.)");
      return;
    }

    // Double-check the current stop status before showing the error
    let currentStatus = stopStatus;

    // If we don't have a status or it's not "ARRIVED", try to fetch it again
    if (currentStatus !== "ARRIVED") {
      try {
        const token =
          sessionStorage.getItem("token") ||
          localStorage.getItem("token") ||
          "";
        if (token) {
          const response = await fetch(`/api/driver/stops/${stopId}/status`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log("Double-checking stop status:", data.status);
            currentStatus = data.status;
            setStopStatus(data.status);
          }
        }
      } catch (error) {
        console.error("Error double-checking stop status:", error);
      }
    }

    // Now check with the latest status
    if (currentStatus !== "ARRIVED") {
      console.error("Stop status is not ARRIVED:", currentStatus);
      setError(
        "You must mark the stop as 'Arrived' before uploading an invoice"
      );
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use window check for client-side only code
      let token = "";
      if (typeof window !== "undefined") {
        // Check both sessionStorage (for drivers) and localStorage (for admins)
        token =
          sessionStorage.getItem("token") ||
          localStorage.getItem("token") ||
          "";
      }

      const response = await fetch(`/api/driver/stops/${stopId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        // Try to get error details from the response
        let errorMessage = "Failed to upload invoice";
        try {
          const errorData = await response.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
          // Use status text if available
          if (response.statusText) {
            errorMessage = `Upload failed: ${response.statusText}`;
          }

          // Add more specific messages for common status codes
          if (response.status === 401) {
            errorMessage = "Authentication failed. Please log in again.";
          } else if (response.status === 403) {
            errorMessage = "You don't have permission to upload files.";
          } else if (response.status === 413) {
            errorMessage =
              "The file is too large. Please select a smaller file.";
          }
        }

        throw new Error(errorMessage);
      }

      // Parse the successful response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Error parsing success response:", parseError);
        throw new Error("Error processing server response");
      }

      // Store the PDF URL for the complete button to use
      setPdfUrl(data.pdfUrl);

      // If markAsCompleted is true, update the stop status to COMPLETED (this is now optional)
      if (markAsCompleted) {
        await markDeliveryAsCompleted(data.pdfUrl);
      }

      onUploadSuccess(data.pdfUrl);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Error uploading invoice:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-5 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">Signed Invoice</h2>
      </div>

      <div className="p-5">
        {existingPdfUrl ? (
          <div className="bg-green-50 rounded-lg p-5 border border-green-200">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-green-600"
                  xmlns="http://www.w3.org/2000/svg"
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
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  Invoice uploaded successfully!
                </h3>
                <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                  <a
                    href={existingPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
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
                    View Signed Invoice
                  </a>

                  {stopStatus === "ARRIVED" && (
                    <button
                      onClick={() =>
                        markDeliveryAsCompleted(existingPdfUrl || "")
                      }
                      disabled={isMarkingCompleted}
                      className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isMarkingCompleted ? (
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
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-5 w-5 mr-2"
                            xmlns="http://www.w3.org/2000/svg"
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
                          Complete Delivery
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-4">
              Take a photo of the signed invoice and upload it here.
            </p>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-4">
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
            )}

            <div
              className="flex items-center justify-center w-full"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isDragging
                    ? "border-black bg-gray-100"
                    : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <div className="flex flex-col items-center justify-center py-6 px-4">
                  {isUploading || isMarkingCompleted ? (
                    <div className="text-center">
                      <LoadingSpinner size="lg" className="mb-3 text-black" />
                      <p className="text-sm font-medium text-gray-700">
                        {isUploading
                          ? "Uploading..."
                          : "Completing delivery..."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <svg
                        className="w-10 h-10 mb-3 text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
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
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        Take a photo of the signed invoice
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PNG, JPG, GIF (MAX. 10MB)
                      </p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  disabled={isUploading || isMarkingCompleted}
                  ref={fileInputRef}
                />
              </label>
            </div>

            <div className="mt-4">
              <p className="text-xs text-gray-500 text-center">
                The uploaded image will be converted to PDF format
                automatically. After uploading, click the "Complete Delivery"
                button to finalize the delivery.
              </p>
            </div>

            {pdfUrl && stopStatus === "ARRIVED" && (
              <div className="mt-4">
                <button
                  onClick={() => markDeliveryAsCompleted(pdfUrl)}
                  disabled={isMarkingCompleted}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isMarkingCompleted ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-5 w-5 mr-2"
                        xmlns="http://www.w3.org/2000/svg"
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
                      Complete Delivery
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  xmlns="http://www.w3.org/2000/svg"
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
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Warning: Images Will Be Replaced
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p className="font-semibold text-yellow-700">
                    Uploading new images will replace ALL previously uploaded images for this delivery.
                  </p>
                  <p>
                    Please ensure you are uploading <strong>ALL required images at once</strong>, including any previously uploaded images you want to keep.
                  </p>
                  <p>
                    If you only upload a single missing image, all other images will be lost.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCancelUpload}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200"
              >
                Continue Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
