"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import EnhancedTable from "@/components/ui/EnhancedTable";
import Pagination from "@/components/ui/Pagination";
import { useSuperAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

interface RecentRoute {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  stopsCount: number;
}

interface PendingDocument {
  id: string;
  title: string;
}

interface UserStats {
  user: {
    id: string;
    username: string;
    fullName: string | null;
    role: "ADMIN" | "DRIVER" | "SUPER_ADMIN";
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    lastKnownLatitude: number | null;
    lastKnownLongitude: number | null;
    lastLocationUpdate: string | null;
    cachedClockInStatus: boolean;
  };
  routes: {
    total: number;
    byStatus: {
      PENDING: number;
      IN_PROGRESS: number;
      COMPLETED: number;
      CANCELLED: number;
    };
    firstRouteDate: string | null;
    lastRouteDate: string | null;
    recent: RecentRoute[];
  };
  stops: {
    total: number;
  };
  safetyChecks: {
    total: number;
    byType: {
      START_OF_DAY: number;
      END_OF_DAY: number;
    };
  };
  documents: {
    totalAcknowledged: number;
    pending: PendingDocument[];
    pendingCount: number;
  };
  vehicle: {
    current: {
      id: string;
      assignedAt: string;
      vehicleId: string;
      vehicleNumber: string;
    } | null;
    totalAssignments: number;
  };
  lastActivity: string | null;
}

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const userId = unwrappedParams.id;

  const { token, isLoading: authLoading, isAuthenticated } = useSuperAdminAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [routes, setRoutes] = useState<RecentRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState("");
  const [routesPage, setRoutesPage] = useState(1);
  const [routesPerPage, setRoutesPerPage] = useState(10);
  const [routesTotal, setRoutesTotal] = useState(0);

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token, userId]);

  const fetchRoutes = useCallback(async () => {
    if (!token) return;

    setRoutesLoading(true);
    setRoutesError("");

    try {
      const response = await fetch(
        `/api/super-admin/users/${userId}/routes?page=${routesPage}&limit=${routesPerPage}`,
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
      setRoutes(data.routes);
      setRoutesTotal(data.totalCount);
    } catch (err) {
      setRoutesError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setRoutesLoading(false);
    }
  }, [token, userId, routesPage, routesPerPage]);

  useEffect(() => {
    if (token) {
      fetchRoutes();
    }
  }, [fetchRoutes, token]);

  const fetchStats = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/super-admin/users/${userId}/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch user stats");
      }

      const data: UserStats = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "DRIVER":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRouteStatusBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getLastActivityInfo = (lastActivity: string | null) => {
    if (!lastActivity) {
      return {
        label: "No activity yet",
        className: "text-gray-500 bg-gray-100",
      };
    }

    const daysSince =
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince <= 7) {
      return {
        label: `Last Activity: ${formatDateTime(lastActivity)}`,
        className: "text-green-800 bg-green-100",
      };
    }

    if (daysSince <= 30) {
      return {
        label: `Last Activity: ${formatDateTime(lastActivity)}`,
        className: "text-yellow-800 bg-yellow-100",
      };
    }

    return {
      label: `Last Activity: ${formatDateTime(lastActivity)}`,
      className: "text-gray-600 bg-gray-100",
    };
  };

  if (authLoading) {
    return <AuthLoadingSpinner message="Checking permissions..." />;
  }

  if (!authLoading && !isAuthenticated) {
    return <AccessDenied title="Access Denied" message="Super Admin access required" />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error || "User not found"}</p>
            <Link
              href="/admin/user-management"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to User Management
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { user } = stats;
  const activityInfo = getLastActivityInfo(stats.lastActivity);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/admin/user-management"
          className="text-gray-600 hover:text-gray-800 font-medium inline-block"
        >
          ← Back to User Management
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-medium text-gray-900">
                {user.fullName || user.username}
              </h1>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeClass(
                  user.role
                )}`}
              >
                {user.role.replace("_", " ")}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">@{user.username}</p>
            <p className="text-sm text-gray-500 mt-1">
              Created {formatDate(user.createdAt)}
            </p>
          </div>
          <div>
            <span
              className={`inline-flex px-3 py-2 text-sm font-medium rounded-lg ${activityInfo.className}`}
            >
              {activityInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.routes.total}</p>
          <p className="text-sm text-gray-500 mt-1">Total Routes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats.routes.byStatus.COMPLETED}
          </p>
          <p className="text-sm text-gray-500 mt-1">Completed Routes</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.stops.total}</p>
          <p className="text-sm text-gray-500 mt-1">Total Stops</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats.safetyChecks.total}
          </p>
          <p className="text-sm text-gray-500 mt-1">Safety Checks Submitted</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats.documents.totalAcknowledged}
          </p>
          <p className="text-sm text-gray-500 mt-1">Documents Acknowledged</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats.vehicle.current ? stats.vehicle.current.vehicleNumber : "None"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Current Vehicle</p>
        </div>
      </div>

      {/* Route status breakdown */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Route Status Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-yellow-50">
            <span className="text-sm font-medium text-yellow-800">Pending</span>
            <span className="text-sm font-bold text-yellow-800">
              {stats.routes.byStatus.PENDING}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-blue-50">
            <span className="text-sm font-medium text-blue-800">In Progress</span>
            <span className="text-sm font-bold text-blue-800">
              {stats.routes.byStatus.IN_PROGRESS}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-50">
            <span className="text-sm font-medium text-green-800">Completed</span>
            <span className="text-sm font-bold text-green-800">
              {stats.routes.byStatus.COMPLETED}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-50">
            <span className="text-sm font-medium text-red-800">Cancelled</span>
            <span className="text-sm font-bold text-red-800">
              {stats.routes.byStatus.CANCELLED}
            </span>
          </div>
        </div>
      </div>

      {/* Recent routes */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200">
          <h2 className="text-lg font-medium text-mono-800">Recent Routes</h2>
        </div>
        <div className="p-6">
          {routesError && (
            <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {routesError}
            </div>
          )}
          <EnhancedTable
            data={routes}
            keyField="id"
            isLoading={routesLoading}
            emptyState={
              <div className="text-center py-8 text-gray-500">
                No routes found for this driver.
              </div>
            }
            columns={[
              {
                header: "Date",
                accessor: (route) => formatDate(route.date),
              },
              {
                header: "Route #",
                accessor: (route) => route.routeNumber || "N/A",
              },
              {
                header: "Status",
                accessor: (route) => (
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRouteStatusBadgeClass(
                      route.status
                    )}`}
                  >
                    {route.status.replace("_", " ")}
                  </span>
                ),
              },
              {
                header: "Stops",
                accessor: (route) => route.stopsCount,
              },
              {
                header: "",
                accessor: (route) => (
                  <Link
                    href={`/admin/routes/${route.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </Link>
                ),
                align: "right",
              },
            ]}
            striped
          />
        </div>
        <Pagination
          totalItems={routesTotal}
          itemsPerPage={routesPerPage}
          currentPage={routesPage}
          onPageChange={setRoutesPage}
          onItemsPerPageChange={(newLimit) => {
            setRoutesPerPage(newLimit);
            setRoutesPage(1);
          }}
        />
      </div>

      {/* Vehicle assignment info */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Vehicle Assignment
        </h2>
        {stats.vehicle.current ? (
          <div className="flex items-center">
            <span className="text-lg font-medium text-green-700 mr-2">
              {stats.vehicle.current.vehicleNumber}
            </span>
            <span className="text-sm text-gray-500">
              (Assigned: {formatDate(stats.vehicle.current.assignedAt)})
            </span>
          </div>
        ) : (
          <p className="text-gray-500 italic">No vehicle currently assigned</p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          Total historical assignments: {stats.vehicle.totalAssignments}
        </p>
      </div>

      {/* Pending required documents */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Pending Required Documents
        </h2>
        {stats.documents.pending.length === 0 ? (
          <p className="text-gray-500 italic">
            No pending required documents. All up to date.
          </p>
        ) : (
          <ul className="list-disc list-inside space-y-1">
            {stats.documents.pending.map((doc) => (
              <li key={doc.id} className="text-sm text-gray-700">
                {doc.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
