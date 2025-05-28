"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EnhancedTable, { Column } from "@/components/ui/EnhancedTable";
import TableActions, { Action } from "@/components/ui/TableActions";
import Pagination from "@/components/ui/Pagination";
import StatusBadge from "@/components/ui/StatusBadge";

interface Route {
  id: string;
  routeNumber: string;
  date: string;
  status: string;
  driver: {
    id: string;
    username: string;
    fullName: string;
  };
  _count: {
    stops: number;
  };
}

interface RoutesResponse {
  routes: Route[];
  totalCount: number;
  limit: number;
  offset: number;
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Get the token from localStorage
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchRoutes();
    }
  }, [token, limit, offset, dateFilter, statusFilter]);

  const fetchRoutes = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      // Build the query string
      const queryParams = new URLSearchParams();
      if (dateFilter) queryParams.append("date", dateFilter);
      if (statusFilter) queryParams.append("status", statusFilter);
      queryParams.append("limit", limit.toString());
      queryParams.append("offset", offset.toString());

      const response = await fetch(
        `/api/admin/routes?${queryParams.toString()}`,
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

      const data: RoutesResponse = await response.json();
      setRoutes(data.routes);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setOffset(0); // Reset to first page when changing limit
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
    setOffset(0); // Reset to first page when changing filter
  };

  const handleStatusFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setStatusFilter(e.target.value);
    setOffset(0); // Reset to first page when changing filter
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-primary-orange bg-opacity-10 text-primary-orange";
      case "IN_PROGRESS":
        return "bg-primary-blue bg-opacity-10 text-primary-blue";
      case "COMPLETED":
        return "bg-primary-green bg-opacity-10 text-primary-green";
      case "CANCELLED":
        return "bg-primary-red bg-opacity-10 text-primary-red";
      default:
        return "bg-mono-200 text-mono-700";
    }
  };

  const handleDeleteRoute = async (route: Route) => {
    setRouteToDelete(route);
    setShowDeleteDialog(true);
  };

  const confirmDeleteRoute = async () => {
    if (!token || !routeToDelete) return;

    setDeleteLoading(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/admin/routes/${routeToDelete.id}/delete?force=true`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete route");
      }

      // Success - route deleted
      console.log("Route deleted successfully:", data);

      // Refresh the routes list
      await fetchRoutes();

      // Reset dialog state
      setShowDeleteDialog(false);
      setRouteToDelete(null);
      setDeleteError("");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeleteLoading(false);
    }
  };

  const resetDeleteDialog = () => {
    setShowDeleteDialog(false);
    setRouteToDelete(null);
    setDeleteError("");
    setDeleteLoading(false);
  };

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-medium text-gray-900">Routes</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/admin/routes/upload"
              className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center"
            >
              Upload Route
            </Link>
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center justify-center text-primary-blue hover:text-blue-700 transition duration-200 font-medium py-2 px-4 border border-primary-blue rounded-lg hover:bg-blue-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">Route List</h2>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-mono-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={handleDateFilterChange}
                className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mono-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFilter("");
                  setStatusFilter("");
                  setOffset(0);
                }}
                className="w-full py-2 px-4 border border-mono-300 rounded-lg text-sm font-medium text-mono-700 hover:bg-mono-100 focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 transition duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-primary-red bg-opacity-10 border border-primary-red border-opacity-30 text-primary-red px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Table container with fixed layout */}
          <div className="flex flex-col min-h-[500px]">
            {/* Content area (grows to fill available space) */}
            <div className="flex-grow">
              {error ? (
                <div className="text-center py-8 text-red-500">{error}</div>
              ) : (
                <EnhancedTable
                  data={routes}
                  keyField="id"
                  isLoading={loading}
                  emptyState={
                    <div className="text-center py-8 text-gray-500">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 mx-auto text-gray-300 mb-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      No routes found. Try adjusting your filters or{" "}
                      <Link
                        href="/admin/routes/upload"
                        className="text-primary-blue hover:text-blue-700 font-medium"
                      >
                        upload a new route
                      </Link>
                      .
                    </div>
                  }
                  columns={[
                    {
                      header: "Route #",
                      accessor: (route) => route.routeNumber || "N/A",
                    },
                    {
                      header: "Date",
                      accessor: (route) => formatDate(route.date),
                    },
                    {
                      header: "Status",
                      accessor: (route) => (
                        <StatusBadge status={route.status} />
                      ),
                    },
                    {
                      header: "Stops",
                      accessor: (route) => route._count.stops,
                    },
                    {
                      header: "Actions",
                      accessor: (route) => (
                        <TableActions
                          actions={[
                            {
                              label: "View",
                              href: `/admin/routes/${route.id}`,
                              variant: "primary",
                            },
                            {
                              label: "Edit",
                              href: `/admin/routes/${route.id}/edit`,
                              variant: "success",
                            },
                            {
                              label: "Delete",
                              onClick: () => handleDeleteRoute(route),
                              variant: "danger",
                            },
                          ]}
                        />
                      ),
                      align: "right",
                    },
                  ]}
                  striped
                  stickyHeader
                />
              )}
            </div>

            {/* Pagination */}
            <Pagination
              totalItems={totalCount}
              itemsPerPage={limit}
              currentPage={Math.floor(offset / limit) + 1}
              onPageChange={(page) => handlePageChange((page - 1) * limit)}
              onItemsPerPageChange={handleLimitChange}
              itemsPerPageOptions={[10, 25, 50, 100]}
              className="mt-4"
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && routeToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="mt-4 text-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete Route
                </h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete route "{routeToDelete.routeNumber}"?
                    This action cannot be undone and will permanently remove the route and all its stops.
                  </p>
                </div>

                {deleteError && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-red-400"
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
                        <p className="text-sm text-red-700">{deleteError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-center space-x-3 mt-6">
                  <button
                    onClick={resetDeleteDialog}
                    disabled={deleteLoading}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteRoute}
                    disabled={deleteLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
                  >
                    {deleteLoading && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Delete Route
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
