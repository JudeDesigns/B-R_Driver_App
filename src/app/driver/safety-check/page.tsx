"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SafetyCheckPage() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [error, setError] = useState("");
  const router = useRouter();

  // Form state
  const [vehicleChecked, setVehicleChecked] = useState(false);
  const [lightsChecked, setLightsChecked] = useState(false);
  const [tiresChecked, setTiresChecked] = useState(false);
  const [fluidsChecked, setFluidsChecked] = useState(false);
  const [safetyEquipmentChecked, setSafetyEquipmentChecked] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // Check if user is logged in and has driver role
    try {
      // Check both localStorage and sessionStorage, with preference for sessionStorage for drivers
      let storedToken, userRole;

      // First check sessionStorage (preferred for drivers)
      storedToken = sessionStorage.getItem("token");
      userRole = sessionStorage.getItem("userRole");

      // If not found in sessionStorage, check localStorage
      if (!storedToken) {
        storedToken = localStorage.getItem("token");
        userRole = localStorage.getItem("userRole");
      }

      if (!storedToken || userRole !== "DRIVER") {
        console.log(
          "Driver authentication failed in safety check page, redirecting to login"
        );
        router.push("/login");
      } else {
        console.log("Driver authenticated successfully in safety check page");
        setToken(storedToken);
      }
    } catch (error) {
      console.error(
        "Error checking driver authentication in safety check page:",
        error
      );
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      // Check if a specific route ID was provided in the URL
      const urlParams = new URLSearchParams(window.location.search);
      const routeIdParam = urlParams.get("routeId");

      if (routeIdParam) {
        // If a specific route ID was provided, set it as selected
        setSelectedRouteId(routeIdParam);
        fetchRouteDetails(routeIdParam);
      } else {
        // Otherwise, fetch all pending routes
        fetchPendingRoutes();
      }
    }
  }, [token]);

  const fetchRouteDetails = async (routeId: string) => {
    if (!token) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/driver/routes/${routeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch route details");
      }

      const data = await response.json();

      // Add the route to the routes array
      setRoutes([data.route]);
      setSelectedRouteId(data.route.id);
    } catch (error) {
      console.error("Error fetching route details:", error);
      setError("Failed to load route details. Please try again.");

      // If we can't fetch the specific route, fall back to fetching all routes
      fetchPendingRoutes();
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRoutes = async () => {
    if (!token) return;

    setLoading(true);

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      // First, check which routes need safety checks
      const safetyResponse = await fetch(
        `/api/driver/safety-check/status?date=${today}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (safetyResponse.ok) {
        const safetyData = await safetyResponse.json();
        console.log("Safety check status:", safetyData);

        if (
          safetyData.routesNeedingChecks &&
          safetyData.routesNeedingChecks.length > 0
        ) {
          // If there are routes needing safety checks, use those
          setRoutes(safetyData.routesNeedingChecks);

          // If there's only one route, select it automatically
          if (safetyData.routesNeedingChecks.length === 1) {
            setSelectedRouteId(safetyData.routesNeedingChecks[0].id);
          }

          setLoading(false);
          return;
        }
      }

      // If no routes need safety checks or the safety check API failed, fall back to the assigned routes API
      const response = await fetch(
        `/api/driver/assigned-routes?date=${today}&status=PENDING`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch routes");
      }

      const data = await response.json();
      setRoutes(data.routes || []);

      // If there's only one route, select it automatically
      if (data.routes && data.routes.length === 1) {
        setSelectedRouteId(data.routes[0].id);
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
      setError("Failed to load routes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token || !selectedRouteId) {
      setError("Please select a route");
      return;
    }

    // Validate form
    if (
      !vehicleChecked ||
      !lightsChecked ||
      !tiresChecked ||
      !fluidsChecked ||
      !safetyEquipmentChecked
    ) {
      setError("Please complete all safety checks before submitting");
      return;
    }

    setLoading(true);
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
          type: "START_OF_DAY",
          details: {
            checks: {
              vehicleChecked,
              lightsChecked,
              tiresChecked,
              fluidsChecked,
              safetyEquipmentChecked,
            },
            notes,
            timestamp: new Date().toISOString(),
          },
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
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-20">
      <h1 className="text-2xl font-medium text-black text-center mt-6">
        Safety Checklist
      </h1>

      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="p-6">
          <div className="border-l-4 border-yellow-300 pl-4 py-2 mb-6 bg-yellow-50">
            <p className="text-sm text-gray-600">
              You must complete this safety checklist before starting your
              route. This helps ensure both your safety and the safety of
              others.
            </p>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-6 mb-8">
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Select Route
                </h3>
                <div className="space-y-4">
                  {routes.length > 0 ? (
                    <select
                      value={selectedRouteId}
                      onChange={(e) => setSelectedRouteId(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Select a route --</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.routeNumber || "Route"} -{" "}
                          {new Date(route.date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No pending routes available.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Vehicle Safety Checks
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="vehicle-check"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      checked={vehicleChecked}
                      onChange={(e) => setVehicleChecked(e.target.checked)}
                      required
                    />
                    <label
                      htmlFor="vehicle-check"
                      className="ml-3 block text-sm text-gray-600"
                    >
                      I have inspected the vehicle for any visible damage or
                      issues
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="lights-check"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      checked={lightsChecked}
                      onChange={(e) => setLightsChecked(e.target.checked)}
                      required
                    />
                    <label
                      htmlFor="lights-check"
                      className="ml-3 block text-sm text-gray-600"
                    >
                      All lights (headlights, brake lights, turn signals) are
                      working properly
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="tires-check"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      checked={tiresChecked}
                      onChange={(e) => setTiresChecked(e.target.checked)}
                      required
                    />
                    <label
                      htmlFor="tires-check"
                      className="ml-3 block text-sm text-gray-600"
                    >
                      Tires are properly inflated and in good condition
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fluids-check"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      checked={fluidsChecked}
                      onChange={(e) => setFluidsChecked(e.target.checked)}
                      required
                    />
                    <label
                      htmlFor="fluids-check"
                      className="ml-3 block text-sm text-gray-600"
                    >
                      Fluid levels (oil, coolant, washer fluid) are adequate
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="safety-equipment-check"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      checked={safetyEquipmentChecked}
                      onChange={(e) =>
                        setSafetyEquipmentChecked(e.target.checked)
                      }
                      required
                    />
                    <label
                      htmlFor="safety-equipment-check"
                      className="ml-3 block text-sm text-gray-600"
                    >
                      Safety equipment (first aid kit, fire extinguisher) is
                      present and accessible
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Additional Notes
                </h3>
                <textarea
                  className="w-full p-3 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter any additional notes or concerns here..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                ></textarea>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || routes.length === 0}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Safety Checklist"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
