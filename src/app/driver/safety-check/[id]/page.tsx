"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RouteSpecificSafetyCheckPage({
  params,
}: {
  params: { id: string };
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [route, setRoute] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
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
  }, [token, params.id]);

  const fetchRouteDetails = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/driver/routes/${params.id}/assigned-stops`,
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
        router.push(`/driver/routes/${params.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token || !route) return;

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
          routeId: params.id,
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
              <div className="border-l-4 border-yellow-300 pl-4 py-2 mb-6 bg-yellow-50">
                <p className="text-sm text-gray-600">
                  You must complete this safety checklist before starting your
                  route. This helps ensure both your safety and the safety of
                  others.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-6 mb-8">
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
                        />
                        <label
                          htmlFor="lights-check"
                          className="ml-3 block text-sm text-gray-600"
                        >
                          All lights (headlights, brake lights, turn signals)
                          are working properly
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="tires-check"
                          className="h-4 w-4 text-black border-gray-300 rounded"
                          checked={tiresChecked}
                          onChange={(e) => setTiresChecked(e.target.checked)}
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
                  disabled={submitting}
                  className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Safety Checklist"}
                </button>
              </form>
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
