"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSuperAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

export default function DeleteAllRoutesPage() {
  // Use the Super Admin auth hook
  const { token, userRole, isLoading: authLoading, isAuthenticated } = useSuperAdminAuth();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleDeleteAll = async () => {
    if (!token) {
      setError("You must be logged in to perform this action");
      return;
    }

    if (!window.confirm("Are you sure you want to delete ALL route data? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/routes/delete-all", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete route data");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return <AuthLoadingSpinner message="Checking permissions..." />;
  }

  // Only show access denied if auth is complete and user is not authenticated
  if (!authLoading && !isAuthenticated) {
    return <AccessDenied title="Access Denied" message="Super Admin access required" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Delete All Route Data</h1>
        <button
          onClick={() => router.push("/admin/routes")}
          className="text-blue-500 hover:text-blue-600 transition duration-200"
        >
          &larr; Back to Routes
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-500"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Warning</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>
                    This action will permanently delete ALL route data, including:
                  </p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>All routes</li>
                    <li>All stops</li>
                    <li>All safety checks</li>
                    <li>All route uploads</li>
                    <li>All returns</li>
                    <li>All admin notes</li>
                  </ul>
                  <p className="mt-2 font-bold">
                    This action cannot be undone. Please be certain.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              <p className="font-bold">Data deleted successfully!</p>
              <p className="mt-2">Deleted items:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Routes: {result.deletedCounts.routes}</li>
                <li>Stops: {result.deletedCounts.stops}</li>
                <li>Safety Checks: {result.deletedCounts.safetyChecks}</li>
                <li>Route Uploads: {result.deletedCounts.routeUploads}</li>
                <li>Returns: {result.deletedCounts.returns}</li>
                <li>Admin Notes: {result.deletedCounts.adminNotes}</li>
              </ul>
            </div>
          )}

          <button
            onClick={handleDeleteAll}
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                Deleting...
              </div>
            ) : (
              "Delete ALL Route Data"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
