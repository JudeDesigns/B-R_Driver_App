"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Table from "@/components/ui/Table";
import TableActions from "@/components/ui/TableActions";
import Pagination from "@/components/ui/Pagination";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

interface Vehicle {
  id: string;
  vehicleNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  vin: string | null;
  fuelType: string | null;
  status: string;
  _count?: {
    assignments: number;
  };
  createdAt: string;
}

export default function VehiclesPage() {
  const { token, userRole, isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const router = useRouter();

  // Check if vehicle management is enabled
  const vehicleManagementEnabled = process.env.NEXT_PUBLIC_VEHICLE_MANAGEMENT_ENABLED === "true";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      return;
    }

    if (!vehicleManagementEnabled) {
      return;
    }

    fetchVehicles();
  }, [authLoading, isAuthenticated, limit, offset, search, statusFilter, vehicleManagementEnabled]);

  const fetchVehicles = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/vehicles?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch vehicles");
      }

      const data = await response.json();
      setVehicles(data.vehicles);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching vehicles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOffset(0);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setOffset(0);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setOffset(0);
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "MAINTENANCE":
        return "bg-yellow-100 text-yellow-800";
      case "OUT_OF_SERVICE":
        return "bg-red-100 text-red-800";
      case "RETIRED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  if (!vehicleManagementEnabled) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h1 className="text-2xl font-medium text-gray-900 mb-4">Vehicle Management</h1>
          <p className="text-gray-600">
            Vehicle management is currently disabled. Please enable it in your environment configuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-medium text-gray-900">Vehicle Management</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/admin/vehicles/new"
              className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center"
            >
              Add New Vehicle
            </Link>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              id="search"
              placeholder="Search by vehicle number, make, model..."
              value={search}
              onChange={handleSearchChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OUT_OF_SERVICE">Out of Service</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
              Items per page
            </label>
            <select
              id="limit"
              value={limit}
              onChange={handleLimitChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vehicle Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {search || statusFilter !== "ALL"
              ? "No vehicles found matching your criteria."
              : "No vehicles found. Add your first vehicle!"}
          </div>
        ) : (
          <Table
            data={vehicles}
            columns={[
              {
                header: "Vehicle Number",
                accessor: (vehicle) => (
                  <Link
                    href={`/admin/vehicles/${vehicle.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {vehicle.vehicleNumber}
                  </Link>
                ),
              },
              {
                header: "Make",
                accessor: (vehicle) => vehicle.make || "N/A",
              },
              {
                header: "Model",
                accessor: (vehicle) => vehicle.model || "N/A",
              },
              {
                header: "Year",
                accessor: (vehicle) => vehicle.year || "N/A",
              },
              {
                header: "License Plate",
                accessor: (vehicle) => vehicle.licensePlate || "N/A",
              },
              {
                header: "Status",
                accessor: (vehicle) => (
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                      vehicle.status
                    )}`}
                  >
                    {vehicle.status.replace(/_/g, " ")}
                  </span>
                ),
              },
              {
                header: "Assignments",
                accessor: (vehicle) => vehicle._count?.assignments || 0,
                align: "center",
              },
              {
                header: "Actions",
                accessor: (vehicle) => (
                  <TableActions
                    actions={[
                      {
                        label: "View",
                        href: `/admin/vehicles/${vehicle.id}`,
                        variant: "primary",
                      },
                      {
                        label: "Edit",
                        href: `/admin/vehicles/${vehicle.id}/edit`,
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
      {totalCount > limit && (
        <Pagination
          currentOffset={offset}
          limit={limit}
          totalCount={totalCount}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}

