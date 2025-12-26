"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EnhancedSafetyChecklist, {
  SafetyCheckData,
} from "@/components/driver/EnhancedSafetyChecklist";
import DocumentReviewStep from "@/components/driver/DocumentReviewStep";

export default function RouteSpecificSafetyCheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Unwrap the params object using React.use()
  const unwrappedParams = use(params);
  const routeId = unwrappedParams.id;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [route, setRoute] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [documentsAcknowledged, setDocumentsAcknowledged] = useState(false);
  const router = useRouter();

  // We'll use the EnhancedSafetyChecklist component instead of individual form states

  useEffect(() => {
    // Check if user is logged in and has driver role
    const storedToken = localStorage.getItem("token");
    const userRole = localStorage.getItem("userRole");

    if (!storedToken || userRole !== "DRIVER") {
      router.push("/login");
    } else {
      setToken(storedToken);
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      fetchRouteDetails();
    }
  }, [token, routeId]);

  const fetchRouteDetails = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/driver/routes/${routeId}/assigned-stops`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch route details");
      }

      const data = await response.json();
      setRoute(data);

      // If safety check is already completed, redirect to route details
      if (data.safetyCheckCompleted) {
        router.push(`/driver/routes/${routeId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (safetyData: SafetyCheckData) => {
    if (!token || !route) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/driver/safety-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routeId: routeId,
          type: "START_OF_DAY",
          details: safetyData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit safety check");
      }

      // Refresh the page to update the navigation bar
      // Use a timestamp to force a fresh load and prevent caching issues
      window.location.href = `/driver/stops?t=${Date.now()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between mt-6">
        <h1 className="text-2xl font-medium text-black">Safety Checklist</h1>
        <button
          onClick={() => router.push("/driver")}
          className="text-blue-500 hover:text-blue-600 transition duration-200"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      ) : route ? (
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-800 mb-2">
                Route Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Route Number</span>
                  <p className="font-medium">{route.routeNumber || "N/A"}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Date</span>
                  <p className="font-medium">
                    {new Date(route.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              {!documentsAcknowledged && token && (
                <DocumentReviewStep
                  token={token}
                  onComplete={() => setDocumentsAcknowledged(true)}
                />
              )}

              {documentsAcknowledged && (
                <>
                  <div className="border-l-4 border-yellow-300 pl-4 py-2 mb-6 bg-yellow-50">
                    <p className="text-sm text-gray-600">
                      You must complete this safety checklist before starting your
                      route. This helps ensure both your safety and the safety of
                      others.
                    </p>
                  </div>

                  <EnhancedSafetyChecklist
                    onSubmit={handleSubmit}
                    isSubmitting={submitting}
                    checklistType="START_OF_DAY"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Route not found. It may have been deleted or you may not have
          permission to view it.
        </div>
      )}
    </div>
  );
}
