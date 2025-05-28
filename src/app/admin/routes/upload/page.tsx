"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ColumnMappingModal from "@/components/ColumnMappingModal";

interface UploadResult {
  message: string;
  routeId?: string;
  routeNumber?: string;
  // driverName removed as requested
  stopCount?: number;
  warnings?: string[];
  rowsProcessed?: number;
  rowsSucceeded?: number;
  rowsFailed?: number;
  isUpdate?: boolean;
}

interface PreviewResult {
  message: string;
  routeNumber?: string;
  date?: string;
  stopCount?: number;
  sampleStops?: any[];
  driverSummary?: Record<string, number>;
  warnings?: string[];
  rowsProcessed?: number;
  rowsSucceeded?: number;
  rowsFailed?: number;
}

export default function RouteUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [conflictDetected, setConflictDetected] = useState(false);
  const [existingRoute, setExistingRoute] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [uploadAction, setUploadAction] = useState<'create' | 'update' | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Get the token and user role from localStorage
    const storedToken = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");

    // Redirect if not an admin or super admin
    if (!storedToken || (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN")) {
      router.push("/admin");
      return;
    }

    if (storedToken) {
      setToken(storedToken);
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
      setPreview(null);
      setShowPreview(false);
      // Reset conflict state when new file is selected
      setConflictDetected(false);
      setExistingRoute(null);
      setShowConfirmDialog(false);
      setUploadAction(null);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      setError("Please select an Excel file to preview");
      return;
    }

    if (!token) {
      setError("You must be logged in to preview routes");
      return;
    }

    // Check file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "xlsx" && fileExtension !== "xls") {
      setError("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setPreviewLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Check for conflicts first
      const conflictResponse = await fetch("/api/admin/routes/check-conflict", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const conflictData = await conflictResponse.json();

      if (!conflictResponse.ok) {
        throw new Error(
          conflictData.message ||
            (conflictData.errors && conflictData.errors.length > 0
              ? conflictData.errors.join("; ")
              : "Failed to check for conflicts")
        );
      }

      // Set conflict information
      setConflictDetected(conflictData.hasConflict);
      setExistingRoute(conflictData.existingRoute);

      // Set preview data
      setPreview({
        ...conflictData.newRoute,
        ...conflictData.parseResult,
        hasConflict: conflictData.hasConflict,
        existingRoute: conflictData.existingRoute,
      });
      setShowPreview(true);

      // If there's a conflict, show the confirmation dialog
      if (conflictData.hasConflict) {
        setShowConfirmDialog(true);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during preview";
      setError(errorMessage);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, action?: string) => {
    if (e) e.preventDefault();

    if (!file) {
      setError("Please select an Excel file to upload");
      return;
    }

    if (!token) {
      setError("You must be logged in to upload routes");
      return;
    }

    // Check file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "xlsx" && fileExtension !== "xls") {
      setError("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setLoading(true);
    setError("");
    setShowConfirmDialog(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (action) {
        formData.append("action", action);
      }

      const response = await fetch("/api/admin/routes/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            (data.errors && data.errors.length > 0
              ? data.errors.join("; ")
              : "Failed to upload route")
        );
      }

      setSuccess(true);
      setResult(data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during upload";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRoute = () => {
    if (result?.routeId) {
      router.push(`/admin/routes/${result.routeId}`);
    }
  };

  const handleBackToDashboard = () => {
    router.push("/admin");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-black">Upload Route</h1>
        <button
          onClick={() => router.back()}
          className="text-primary-blue hover:text-blue-700 transition duration-200 font-medium"
        >
          &larr; Back
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">Excel Upload</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-primary-blue hover:text-blue-700 text-sm font-medium"
          >
            View Column Mapping
          </button>
        </div>

        {/* Column Mapping Modal */}
        <ColumnMappingModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
        <div className="p-6">
          {success ? (
            <div className="space-y-4">
              <div className="bg-primary-green bg-opacity-10 border border-primary-green border-opacity-30 text-primary-green px-4 py-3 rounded-lg mb-4">
                <div className="flex items-center mb-2">
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <p className="font-medium">
                    {result?.isUpdate
                      ? "Route updated successfully!"
                      : "Route uploaded successfully!"}
                  </p>
                </div>
                <div className="ml-7">
                  <p className="text-sm">
                    <span className="font-medium">Route Number:</span>{" "}
                    {result?.routeNumber || "N/A"}
                    <br />
                    {/* Driver line removed as requested */}
                    <span className="font-medium">Stops:</span>{" "}
                    {result?.stopCount || 0}
                  </p>
                </div>
              </div>

              {result?.warnings && result.warnings.length > 0 && (
                <div className="bg-primary-orange bg-opacity-10 border border-primary-orange border-opacity-30 text-primary-orange px-4 py-3 rounded-lg mb-4">
                  <div className="flex items-center mb-2">
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <p className="font-medium">Warnings:</p>
                  </div>
                  <ul className="list-disc pl-7 mt-2 text-sm">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-mono-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-mono-700 mb-2">
                  Processing Summary
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-mono-500">Rows Processed</p>
                    <p className="text-xl font-medium text-mono-800">
                      {result?.rowsProcessed || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-mono-500">Rows Succeeded</p>
                    <p className="text-xl font-medium text-primary-green">
                      {result?.rowsSucceeded || 0}
                    </p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="text-xs text-mono-500">Rows Failed</p>
                    <p className="text-xl font-medium text-primary-red">
                      {result?.rowsFailed || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 mt-6">
                <button
                  onClick={handleViewRoute}
                  className="bg-black hover:bg-mono-800 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 transition duration-200"
                >
                  View Route
                </button>
                <button
                  onClick={handleBackToDashboard}
                  className="bg-mono-200 hover:bg-mono-300 text-mono-800 font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 transition duration-200"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="bg-primary-red bg-opacity-10 border border-primary-red border-opacity-30 text-primary-red px-4 py-3 rounded-lg mb-4 flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-mono-800 text-sm font-medium mb-2">
                  Upload Excel File
                </label>
                <div className="border-2 border-dashed border-mono-300 hover:border-primary-blue rounded-lg p-8 text-center transition-colors duration-200">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="flex flex-col items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-primary-green mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-mono-700 font-medium">
                          {file.name}
                        </span>
                        <span className="text-xs text-mono-500 mt-1">
                          Click to change file
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-primary-blue mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <span className="text-primary-blue font-medium">
                          Click to upload
                        </span>
                        <span className="text-mono-500 mt-1">
                          or drag and drop
                        </span>
                      </div>
                    )}
                  </label>
                  <p className="text-xs text-mono-500 mt-4">
                    Only Excel files (.xlsx, .xls) are supported
                  </p>
                </div>
              </div>

              <div className="bg-primary-blue bg-opacity-5 p-5 rounded-lg mb-6">
                <div className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-primary-blue mr-2 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-primary-blue mb-2">
                      Important Notes
                    </h3>
                    <ul className="text-sm text-mono-700 space-y-2 list-disc pl-5">
                      <li>
                        Make sure the Excel file follows the format of the
                        sample file.
                      </li>
                      <li>
                        The driver name must match an existing driver in the
                        system.
                      </li>
                      <li>
                        The system will create new customers if they don't
                        already exist.
                      </li>
                      <li>The first row should contain column headers.</li>
                      <li>
                        Rows with missing essential data (like customer name)
                        will be skipped.
                      </li>
                      <li>
                        If you upload a file with the same route number as an
                        existing route, you'll be asked to choose whether to update
                        the existing route or create a new one.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Preview Section */}
              {showPreview && preview && (
                <div className="mb-6 bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Route Preview
                  </h3>

                  {/* Conflict Warning */}
                  {conflictDetected && existingRoute && (
                    <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <svg
                          className="h-5 w-5 text-yellow-500 mr-2"
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
                        <h4 className="font-medium text-yellow-800">Route Conflict Detected</h4>
                      </div>
                      <p className="text-sm text-yellow-700">
                        A route with number <strong>{existingRoute.routeNumber}</strong> already exists.
                        You'll need to choose whether to update the existing route or create a new one.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-3 rounded-md shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">
                        Route Number
                      </p>
                      <p className="text-lg font-semibold">
                        {preview.routeNumber || "N/A"}
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-md shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">Date</p>
                      <p className="text-lg font-semibold">
                        {preview.date
                          ? new Date(preview.date).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-md shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">
                        Total Stops
                      </p>
                      <p className="text-lg font-semibold">
                        {preview.stopCount || 0}
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-md shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">
                        Rows Processed
                      </p>
                      <p className="text-lg font-semibold">
                        {preview.rowsSucceeded || 0} of{" "}
                        {preview.rowsProcessed || 0} successful
                      </p>
                    </div>
                  </div>

                  {/* Driver Summary */}
                  {preview.driverSummary &&
                    Object.keys(preview.driverSummary).length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-gray-800 mb-2">
                          Drivers
                        </h4>
                        <div className="bg-white p-3 rounded-md shadow-sm">
                          <ul className="divide-y divide-gray-200">
                            {Object.entries(preview.driverSummary).map(
                              ([driver, count]) => (
                                <li
                                  key={driver}
                                  className="py-2 flex justify-between"
                                >
                                  <span className="font-medium">{driver}</span>
                                  <span className="text-gray-600">
                                    {count} stops
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )}

                  {/* Sample Stops */}
                  {preview.sampleStops && preview.sampleStops.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-800 mb-2">
                        Sample Stops (First 5)
                      </h4>
                      <div className="bg-white rounded-md shadow-sm overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Seq
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Customer
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Driver
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {preview.sampleStops.map((stop, index) => (
                              <tr key={index}>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {stop.sequence || index + 1}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {stop.customerName}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                  {stop.driverName}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {preview.warnings && preview.warnings.length > 0 && (
                    <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-5 w-5 text-yellow-400"
                            xmlns="http://www.w3.org/2000/svg"
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
                          <h3 className="text-sm font-medium text-yellow-800">
                            Warnings
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <ul className="list-disc pl-5 space-y-1">
                              {preview.warnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewLoading || !file}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {previewLoading ? (
                    <div className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-800"
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
                      Checking for conflicts...
                    </div>
                  ) : (
                    "Preview & Check Conflicts"
                  )}
                </button>

{!conflictDetected && (
                  <button
                    type="submit"
                    disabled={loading || !file}
                    className="flex-1 bg-black hover:bg-mono-800 text-white font-medium py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                        Uploading...
                      </div>
                    ) : (
                      "Upload Route"
                    )}
                  </button>
                )}

                {conflictDetected && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDialog(true)}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-30 transition duration-200"
                  >
                    Resolve Conflict
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Conflict Resolution Dialog */}
      {showConfirmDialog && conflictDetected && existingRoute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <svg
                  className="h-8 w-8 text-yellow-500 mr-3"
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
                <h3 className="text-lg font-medium text-gray-900">
                  Route Conflict Detected
                </h3>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  A route with the number <strong>{existingRoute.routeNumber}</strong> already exists.
                  What would you like to do?
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Existing Route</h4>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p><strong>Route:</strong> {existingRoute.routeNumber}</p>
                      <p><strong>Date:</strong> {new Date(existingRoute.date).toLocaleDateString()}</p>
                      <p><strong>Status:</strong> {existingRoute.status}</p>
                      <p><strong>Stops:</strong> {existingRoute.stopCount}</p>
                      <p><strong>Created:</strong> {new Date(existingRoute.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">New Route</h4>
                    <div className="text-sm text-green-800 space-y-1">
                      <p><strong>Route:</strong> {preview?.routeNumber}</p>
                      <p><strong>Date:</strong> {preview?.date ? new Date(preview.date).toLocaleDateString() : 'N/A'}</p>
                      <p><strong>Stops:</strong> {preview?.stopCount || 0}</p>
                      {preview?.driverSummary && (
                        <div>
                          <p><strong>Drivers:</strong></p>
                          <ul className="ml-4 list-disc">
                            {Object.entries(preview.driverSummary).map(([driver, count]) => (
                              <li key={driver}>{driver}: {count} stops</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleSubmit(undefined, 'update')}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Existing Route'}
                </button>

                <button
                  onClick={() => handleSubmit(undefined, 'create')}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create New Route'}
                </button>

                <button
                  onClick={() => setShowConfirmDialog(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Update Existing Route:</strong> Replaces all stops in the existing route with the new data.</p>
                <p><strong>Create New Route:</strong> Creates a new route with a modified route number.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
