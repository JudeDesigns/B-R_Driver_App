"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

export default function NewVehiclePage() {
  const { token, isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    vehicleNumber: "",
    make: "",
    model: "",
    year: "",
    licensePlate: "",
    vin: "",
    fuelType: "GASOLINE",
    status: "ACTIVE",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Prepare data
      const submitData: any = {
        vehicleNumber: formData.vehicleNumber,
        fuelType: formData.fuelType,
        status: formData.status,
      };

      // Add optional fields only if they have values
      if (formData.make) submitData.make = formData.make;
      if (formData.model) submitData.model = formData.model;
      if (formData.year) submitData.year = parseInt(formData.year);
      if (formData.licensePlate) submitData.licensePlate = formData.licensePlate;
      if (formData.vin) submitData.vin = formData.vin;
      if (formData.notes) submitData.notes = formData.notes;

      const response = await fetch("/api/admin/vehicles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create vehicle");
      }

      const data = await response.json();
      router.push(`/admin/vehicles/${data.vehicle.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error creating vehicle:", err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <AuthLoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-medium text-gray-900">Add New Vehicle</h1>
          <Link
            href="/admin/vehicles"
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            ← Back to Vehicles
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vehicle Number - Required */}
          <div>
            <label htmlFor="vehicleNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="vehicleNumber"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., V001, TRUCK-01"
            />
          </div>

          {/* Make and Model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                Make
              </label>
              <input
                type="text"
                id="make"
                name="make"
                value={formData.make}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Ford, Chevrolet"
              />
            </div>
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                id="model"
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., F-150, Silverado"
              />
            </div>
          </div>

          {/* Year, License Plate, VIN */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                min="1900"
                max="2100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2020"
              />
            </div>
            <div>
              <label htmlFor="licensePlate" className="block text-sm font-medium text-gray-700 mb-1">
                License Plate
              </label>
              <input
                type="text"
                id="licensePlate"
                name="licensePlate"
                value={formData.licensePlate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., ABC-1234"
              />
            </div>
            <div>
              <label htmlFor="vin" className="block text-sm font-medium text-gray-700 mb-1">
                VIN
              </label>
              <input
                type="text"
                id="vin"
                name="vin"
                value={formData.vin}
                onChange={handleChange}
                maxLength={17}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="17-character VIN"
              />
            </div>
          </div>

          {/* Fuel Type and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fuelType" className="block text-sm font-medium text-gray-700 mb-1">
                Fuel Type
              </label>
              <select
                id="fuelType"
                name="fuelType"
                value={formData.fuelType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GASOLINE">Gasoline</option>
                <option value="DIESEL">Diesel</option>
                <option value="ELECTRIC">Electric</option>
                <option value="HYBRID">Hybrid</option>
                <option value="CNG">CNG</option>
              </select>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OUT_OF_SERVICE">Out of Service</option>
                <option value="RETIRED">Retired</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about this vehicle..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/admin/vehicles"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition duration-200"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating..." : "Create Vehicle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
