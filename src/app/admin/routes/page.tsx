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
    </div>
  );
}
