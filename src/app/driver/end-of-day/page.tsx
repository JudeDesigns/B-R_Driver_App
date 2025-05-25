"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EnhancedSafetyChecklist, {
  SafetyCheckData,
} from "@/components/driver/EnhancedSafetyChecklist";

export default function EndOfDayCheckPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check authentication from both localStorage and sessionStorage
    const checkAuth = () => {
      try {
        const localStorageToken = localStorage.getItem("token");
        const sessionStorageToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem("token")
            : null;
        const storedToken = sessionStorageToken || localStorageToken;

        // Also check user role
        const localStorageRole = localStorage.getItem("userRole");
        const sessionStorageRole =
          typeof window !== "undefined"
            ? sessionStorage.getItem("userRole")
            : null;
        const userRole = sessionStorageRole || localStorageRole;

        console.log("End-of-day page - Auth check:", {
          hasLocalToken: !!localStorageToken,
          hasSessionToken: !!sessionStorageToken,
          finalToken: !!storedToken,
          userRole,
        });

        if (!storedToken || userRole !== "DRIVER") {
          console.log("No token found or not a driver, redirecting to login");
          router.push("/login");
        } else {
          setToken(storedToken);
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        // Don't redirect immediately on error, as it might be a temporary issue
      }
    };

    // Run the check
    checkAuth();

    // Set up an interval to periodically check authentication
    const authCheckInterval = setInterval(checkAuth, 30000); // Check every 30 seconds

    return () => {
      clearInterval(authCheckInterval);
    };
  }, [router]);

  useEffect(() => {
    if (!token) return;

    const fetchCompletedRoutes = async () => {
      setLoading(true);
      setError("");

      try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split("T")[0];
        console.log("Fetching routes for date:", today);

        // Fetch all assigned routes for today, not just IN_PROGRESS ones
        console.log(
          "Fetching assigned routes with token:",
          token?.substring(0, 10) + "..."
        );
        const response = await fetch(
          `/api/driver/assigned-routes?date=${today}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to fetch routes:", response.status, errorText);
          throw new Error(
            `Failed to fetch routes: ${response.status} ${errorText}`
          );
        }

        const data = await response.json();
        console.log("Assigned routes data:", data);

        // Check which routes have completed start-of-day checks
        console.log("Fetching safety check status");
        const safetyCheckResponse = await fetch(
          `/api/driver/safety-check/status?date=${today}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!safetyCheckResponse.ok) {
          const errorText = await safetyCheckResponse.text();
          console.error(
            "Failed to fetch safety check status:",
            safetyCheckResponse.status,
            errorText
          );
          throw new Error(
            `Failed to fetch safety check status: ${safetyCheckResponse.status} ${errorText}`
          );
        }

        const safetyCheckData = await safetyCheckResponse.json();
        console.log("Safety check data:", safetyCheckData);
        const completedRouteIds = new Set(
          safetyCheckData.completedRouteIds || []
        );
        const completedEndOfDayRouteIds = new Set(
          safetyCheckData.completedEndOfDayRouteIds || []
        );

        console.log(
          "Routes with completed start-of-day checks:",
          Array.from(completedRouteIds)
        );
        console.log(
          "Routes with completed end-of-day checks:",
          Array.from(completedEndOfDayRouteIds)
        );

        // Check if the API returned routes needing end-of-day checks
        let eligibleRoutes = [];

        if (
          safetyCheckData.routesNeedingEndOfDayChecks &&
          safetyCheckData.routesNeedingEndOfDayChecks.length > 0
        ) {
          console.log("Using routes from API that need end-of-day checks");
          // Use the routes directly from the API that need end-of-day checks
          eligibleRoutes = safetyCheckData.routesNeedingEndOfDayChecks.filter(
            (route) => route.status !== "COMPLETED"
          );
        } else {
          console.log("Manually filtering routes that need end-of-day checks");
          // Fall back to manual filtering
          eligibleRoutes = (data.routes || []).filter((route) => {
            const hasStartOfDayCheck = completedRouteIds.has(route.id);
            const hasEndOfDayCheck = completedEndOfDayRouteIds.has(route.id);
            const isCompleted = route.status === "COMPLETED";

            console.log(
              `Route ${route.id} (${
                route.routeNumber || "unnamed"
              }) - Status: ${
                route.status
              }, Has start-of-day: ${hasStartOfDayCheck}, Has end-of-day: ${hasEndOfDayCheck}`
            );

            return hasStartOfDayCheck && !hasEndOfDayCheck && !isCompleted;
          });
        }

        console.log(
          `Found ${eligibleRoutes.length} eligible routes for end-of-day check`
        );

        // If no eligible routes were found, but there are routes in progress, show them anyway
        if (eligibleRoutes.length === 0) {
          console.log(
            "No eligible routes found, checking for IN_PROGRESS routes"
          );
          const inProgressRoutes = (data.routes || []).filter(
            (route) => route.status === "IN_PROGRESS"
          );

          if (inProgressRoutes.length > 0) {
            console.log(
              `Found ${inProgressRoutes.length} IN_PROGRESS routes to show instead`
            );
            setRoutes(inProgressRoutes);
          } else {
            setRoutes(eligibleRoutes);
          }
        } else {
          setRoutes(eligibleRoutes);
        }

        // If there's only one route (eligible or in-progress), select it automatically
        if (routes.length === 1) {
          setSelectedRouteId(routes[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching routes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletedRoutes();
  }, [token]);

  const handleSubmit = async (safetyData: SafetyCheckData) => {
    if (!selectedRouteId) {
      setError("Please select a route");
      return;
    }

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
          routeId: selectedRouteId,
          type: "END_OF_DAY",
          details: safetyData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Failed to submit end-of-day check"
        );
      }

      setSuccess(true);

      // After 2 seconds, redirect to the dashboard
      setTimeout(() => {
        window.location.href = `/driver?t=${Date.now()}`;
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 mobile-spacing prevent-pull-refresh">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-medium text-black mobile-heading">
          End-of-Day Check
        </h1>
        <Link
          href="/driver"
          className="text-primary-blue hover:text-blue-700 transition duration-200 font-medium touch-manipulation tap-target px-2 py-1"
        >
          &larr; Back
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden mobile-card">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-mono-200">
          <h2 className="text-base font-medium text-mono-800 mobile-text">
            Complete End-of-Day Safety Check
          </h2>
        </div>
        <div className="p-4 sm:p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {success ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              End-of-day safety check submitted successfully! Redirecting to
              dashboard...
            </div>
          ) : loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No routes available for end-of-day check.</p>
              <p className="mb-2">This could be because:</p>
              <ul className="list-disc list-inside mb-4 text-left max-w-md mx-auto">
                <li>You haven't completed a start-of-day safety check yet</li>
                <li>
                  You've already submitted end-of-day checks for all your routes
                </li>
                <li>All your routes for today are already completed</li>
                <li>You don't have any routes assigned for today</li>
              </ul>
              <Link
                href="/driver"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Return to dashboard
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label
                  htmlFor="routeSelect"
                  className="block text-sm font-medium text-gray-700 mb-2 mobile-text"
                >
                  Select Route
                </label>
                <select
                  id="routeSelect"
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                  className="block w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
                  required
                >
                  <option value="">-- Select a route --</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.routeNumber
                        ? `Route ${route.routeNumber} - ${new Date(
                            route.date
                          ).toLocaleDateString()}`
                        : `Route from ${new Date(
                            route.date
                          ).toLocaleDateString()}`}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRouteId && (
                <EnhancedSafetyChecklist
                  onSubmit={handleSubmit}
                  isSubmitting={submitting}
                  checklistType="END_OF_DAY"
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
