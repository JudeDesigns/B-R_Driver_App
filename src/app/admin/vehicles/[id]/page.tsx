"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";
import AssignDriverModal from "@/components/admin/vehicles/AssignDriverModal";

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
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicleAssignments: VehicleAssignment[];
}

interface VehicleAssignment {
  id: string;
  assignedAt: string; // Changed from assignedDate to match API/Schema
  isActive: boolean;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  };
  route: {
    id: string;
    routeNumber: string | null;
    date: string;
    status: string;
  } | null;
}

export default function VehicleDetailsPage({ params }: { params: { id: string } }) {
  const { token, isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      return;
    }

    fetchVehicle();
  }, [authLoading, isAuthenticated, params.id]);

  const fetchVehicle = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/vehicles/${params.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch vehicle");
      }

      const data = await response.json();
      setVehicle(data.vehicle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching vehicle:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/vehicles/${params.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete vehicle");
      }

      router.push("/admin/vehicles");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting vehicle:", err);
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleAssignDriver = async (driverId: string, notes: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const response = await fetch(`/api/admin/vehicles/${params.id}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ driverId, notes }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to assign driver");
    }

    // Refresh vehicle data
    fetchVehicle();
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

  const getRouteStatusBadgeClass = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error || "Vehicle not found"}</p>
            <Link
              href="/admin/vehicles"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              ← Back to Vehicles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeAssignment = vehicle.vehicleAssignments?.find(a => a.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/admin/vehicles"
              className="text-gray-600 hover:text-gray-800 font-medium mb-2 inline-block"
            >
              ← Back to Vehicles
            </Link>
            <h1 className="text-2xl font-medium text-gray-900">
              Vehicle: {vehicle.vehicleNumber}
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition duration-200"
            >
              {activeAssignment ? "Change Driver" : "Assign Driver"}
            </button>
            <Link
              href={`/admin/vehicles/${vehicle.id}/edit`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition duration-200"
            >
              Edit Vehicle
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition duration-200"
            >
              Delete
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Vehicle Information */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Vehicle Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Vehicle Number
            </label>
            <p className="text-gray-900">{vehicle.vehicleNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
            <span
              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                vehicle.status
              )}`}
            >
              {vehicle.status.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Make</label>
            <p className="text-gray-900">{vehicle.make || "N/A"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Model</label>
            <p className="text-gray-900">{vehicle.model || "N/A"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Year</label>
            <p className="text-gray-900">{vehicle.year || "N/A"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              License Plate
            </label>
            <p className="text-gray-900">{vehicle.licensePlate || "N/A"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">VIN</label>
            <p className="text-gray-900">{vehicle.vin || "N/A"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Fuel Type
            </label>
            <p className="text-gray-900">{vehicle.fuelType || "N/A"}</p>
          </div>

          {/* Current Driver */}
          <div className="md:col-span-2 border-t pt-4 mt-2">
            <label className="block text-sm font-medium text-gray-500 mb-1">
              Currently Assigned Driver
            </label>
            {activeAssignment ? (
              <div className="flex items-center">
                <span className="text-lg font-medium text-green-700 mr-2">
                  {activeAssignment.driver.fullName || activeAssignment.driver.username}
                </span>
                <span className="text-sm text-gray-500">
                  (Assigned: {new Date(activeAssignment.assignedAt).toLocaleDateString()})
                </span>
              </div>
            ) : (
              <p className="text-gray-500 italic">No driver currently assigned</p>
            )}
          </div>

          {vehicle.notes && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
              <p className="text-gray-900 whitespace-pre-wrap">{vehicle.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Assignment History */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-medium text-gray-900 mb-4">Assignment History</h2>
        {!vehicle.vehicleAssignments || vehicle.vehicleAssignments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No assignments found for this vehicle.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vehicle.vehicleAssignments.map((assignment) => (
                  <tr key={assignment.id} className={`hover:bg-gray-50 ${assignment.isActive ? 'bg-green-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(assignment.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.driver.fullName || assignment.driver.username}
                      {assignment.isActive && <span className="ml-2 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">Active</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {assignment.route ? (
                        <Link
                          href={`/admin/routes/${assignment.route.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {assignment.route.routeNumber || "N/A"}
                        </Link>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {assignment.route ? (
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRouteStatusBadgeClass(
                            assignment.route.status
                          )}`}
                        >
                          {assignment.route.status}
                        </span>
                      ) : (
                        "N/A"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete vehicle <strong>{vehicle.vehicleNumber}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Driver Modal */}
      <AssignDriverModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onAssign={handleAssignDriver}
        currentDriverId={activeAssignment?.driver.id}
      />
    </div>
  );
}

