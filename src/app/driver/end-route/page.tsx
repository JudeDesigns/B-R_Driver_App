"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Return {
  id: string;
  stopId: string;
  orderItemIdentifier: string;
  productDescription: string | null;
  quantity: number;
  reasonCode: string;
  warehouseLocation: string | null;
  vendorCreditNum: string | null;
  createdAt: string;
  updatedAt: string;
  stop?: {
    customerNameFromUpload: string;
    customer: {
      name: string;
    };
  };
}

interface Stop {
  id: string;
  sequence: number;
  status: string;
  customerNameFromUpload: string;
  customer: {
    id: string;
    name: string;
  };
}

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  stops: Stop[];
}

export default function EndRoutePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [returns, setReturns] = useState<Return[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [warehouseLocations, setWarehouseLocations] = useState<{
    [key: string]: string;
  }>({});
  const [vendorCreditNums, setVendorCreditNums] = useState<{
    [key: string]: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  const router = useRouter();

  useEffect(() => {
    fetchActiveRoutes();
  }, []);

  useEffect(() => {
    if (selectedRouteId) {
      fetchRouteReturns(selectedRouteId);
    } else {
      setReturns([]);
    }
  }, [selectedRouteId]);

  const fetchActiveRoutes = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/driver/routes/active", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch active routes");
      }

      const data = await response.json();
      setRoutes(data);

      // If there's only one active route, select it automatically
      if (data.length === 1) {
        setSelectedRouteId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const fetchRouteReturns = async (routeId: string) => {
    setLoadingReturns(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/driver/routes/${routeId}/returns`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch returns");
      }

      const data = await response.json();
      setReturns(data);

      // Initialize warehouse locations and vendor credit numbers
      const initialWarehouseLocations: { [key: string]: string } = {};
      const initialVendorCreditNums: { [key: string]: string } = {};

      data.forEach((returnItem: Return) => {
        initialWarehouseLocations[returnItem.id] =
          returnItem.warehouseLocation || "";
        initialVendorCreditNums[returnItem.id] =
          returnItem.vendorCreditNum || "";
      });

      setWarehouseLocations(initialWarehouseLocations);
      setVendorCreditNums(initialVendorCreditNums);
    } catch (err) {
      console.error("Error fetching returns:", err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const handleUpdateReturn = async (returnId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/driver/returns/${returnId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          warehouseLocation: warehouseLocations[returnId] || null,
          vendorCreditNum: vendorCreditNums[returnId] || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update return");
      }

      // Update the local returns array
      setReturns((prevReturns) =>
        prevReturns.map((item) =>
          item.id === returnId
            ? {
                ...item,
                warehouseLocation: warehouseLocations[returnId] || null,
                vendorCreditNum: vendorCreditNums[returnId] || null,
              }
            : item
        )
      );
    } catch (err) {
      console.error("Error updating return:", err);
    }
  };

  const handleCompleteRoute = async () => {
    if (!selectedRouteId) return;

    setSubmitting(true);
    setSuccess("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // First, update all returns with warehouse locations and vendor credit numbers
      const updatePromises = returns.map((returnItem) =>
        fetch(`/api/driver/returns/${returnItem.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            warehouseLocation: warehouseLocations[returnItem.id] || null,
            vendorCreditNum: vendorCreditNums[returnItem.id] || null,
          }),
        })
      );

      await Promise.all(updatePromises);

      // Then complete the route
      const response = await fetch(
        `/api/driver/routes/${selectedRouteId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to complete route");
      }

      setSuccess("Route completed successfully!");

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/driver/dashboard");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 px-4">
      <h1 className="text-2xl font-medium text-black text-center mt-6">
        End of Route
      </h1>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-md">
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
              {success}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                Route Information
              </h3>

              {routes.length === 0 ? (
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    No active routes found.
                  </p>
                  <div className="mt-4">
                    <Link
                      href="/driver/dashboard"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-gray-800"
                    >
                      Return to Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4">
                  <label
                    htmlFor="routeSelect"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Select Route to Complete
                  </label>
                  <select
                    id="routeSelect"
                    value={selectedRouteId || ""}
                    onChange={(e) => setSelectedRouteId(e.target.value || null)}
                    className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                  >
                    <option value="">Select a route</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.routeNumber
                          ? `Route ${route.routeNumber} - ${formatDate(
                              route.date
                            )}`
                          : `Route ${route.id.substring(0, 8)} - ${formatDate(
                              route.date
                            )}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {selectedRouteId && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Returns Summary
                  </h3>

                  {loadingReturns ? (
                    <div className="flex justify-center items-center py-8 border border-gray-200 rounded-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
                    </div>
                  ) : returns.length === 0 ? (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        No returns logged for this route.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Item
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Quantity
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Reason
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Warehouse Location
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                Vendor Credit #
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {returns.map((returnItem) => (
                              <tr key={returnItem.id}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {returnItem.orderItemIdentifier}
                                  </div>
                                  {returnItem.productDescription && (
                                    <div className="text-xs text-gray-500">
                                      {returnItem.productDescription}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {returnItem.quantity}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                    {returnItem.reasonCode}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <input
                                    type="text"
                                    placeholder="Enter location"
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                                    value={
                                      warehouseLocations[returnItem.id] || ""
                                    }
                                    onChange={(e) => {
                                      setWarehouseLocations({
                                        ...warehouseLocations,
                                        [returnItem.id]: e.target.value,
                                      });
                                    }}
                                    onBlur={() =>
                                      handleUpdateReturn(returnItem.id)
                                    }
                                  />
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <input
                                    type="text"
                                    placeholder="Enter credit #"
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                                    value={
                                      vendorCreditNums[returnItem.id] || ""
                                    }
                                    onChange={(e) => {
                                      setVendorCreditNums({
                                        ...vendorCreditNums,
                                        [returnItem.id]: e.target.value,
                                      });
                                    }}
                                    onBlur={() =>
                                      handleUpdateReturn(returnItem.id)
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex space-x-4 pt-4">
                  <Link
                    href="/driver/dashboard"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-md text-center text-gray-800 hover:bg-gray-50 transition duration-200"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleCompleteRoute}
                    disabled={submitting}
                    className="flex-1 bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center">
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
                        Submitting...
                      </span>
                    ) : (
                      "Complete Route"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
