"use client";

import { useState, useEffect } from "react";

interface SimpleSafetyChecklistProps {
  onSubmit: (data: SimpleSafetyCheckData) => void;
  isSubmitting: boolean;
  vehicle?: {
    id: string;
    vehicleNumber: string;
    fuelInstructions?: string | null;
    fuelType?: string | null;
  } | null;
}

export interface SimpleSafetyCheckData {
  // Basic vehicle check
  date: string;
  truckNumber: string;
  mileage: string;
  fuelLevel: string;

  // Essential safety items
  lightsWorking: boolean;
  tiresCondition: boolean;
  braksWorking: boolean;
  vehicleClean: boolean;

  // Equipment check
  palletJackWorking: boolean;
  dolliesSecured: boolean;
  strapsAvailable: boolean;

  // Pre-departure
  routeReviewed: boolean;
  warehouseContacted: boolean;

  // Notes
  notes: string;
}

export default function SimpleSafetyChecklist({
  onSubmit,
  isSubmitting,
  vehicle,
}: SimpleSafetyChecklistProps) {
  const [formData, setFormData] = useState<SimpleSafetyCheckData>({
    date: new Date().toISOString().split("T")[0],
    truckNumber: vehicle?.vehicleNumber || "",
    mileage: "",
    fuelLevel: "FULL",
    lightsWorking: false,
    tiresCondition: false,
    braksWorking: false,
    vehicleClean: false,
    palletJackWorking: false,
    dolliesSecured: false,
    strapsAvailable: false,
    routeReviewed: false,
    warehouseContacted: false,
    notes: "",
  });

  const [safetyInstructions, setSafetyInstructions] = useState<string | null>(null);
  const [showFuelInstructions, setShowFuelInstructions] = useState(false);

  useEffect(() => {
    if (vehicle?.vehicleNumber) {
      setFormData(prev => ({ ...prev, truckNumber: vehicle.vehicleNumber }));
    }
  }, [vehicle]);

  useEffect(() => {
    fetchSafetyInstructions();
  }, []);

  const fetchSafetyInstructions = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/driver/system-documents?type=SAFETY_INSTRUCTIONS", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.documents && data.documents.length > 0) {
          // Assuming the file path or content is what we want. 
          // For now, let's just show a link if it's a file, or content if it's text.
          // The schema has filePath and fileName.
          // We might need a way to view the content. 
          // For this implementation, I'll assume we want to show a download link or similar.
          // But the user asked for "Interactive Safety Instructions".
          // If it's a PDF, we link it.
          setSafetyInstructions(data.documents[0].fileName);
        }
      }
    } catch (error) {
      console.error("Error fetching safety instructions:", error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (name === "fuelLevel") {
      // Show fuel instructions if level is low or quarter
      if (value === "LOW" || value === "QUARTER") {
        setShowFuelInstructions(true);
      } else {
        setShowFuelInstructions(false);
      }
    }

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Safety Instructions Alert */}
      {safetyInstructions && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-xl">ℹ️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Safety Instructions</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>Please review the daily safety instructions before proceeding.</p>
                {/* In a real app, this would link to the document viewer */}
                <span className="font-semibold underline cursor-pointer">
                  {safetyInstructions}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Basic Vehicle Info */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          🚛 Vehicle Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              min={new Date().toISOString().split("T")[0]}
              max={new Date().toISOString().split("T")[0]}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            />
          </div>

          <div>
            <label htmlFor="truckNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Truck Number
            </label>
            <input
              type="text"
              id="truckNumber"
              name="truckNumber"
              value={formData.truckNumber}
              onChange={handleChange}
              required
              placeholder="e.g., T-001"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            />
          </div>

          <div>
            <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-1">
              Current Mileage
            </label>
            <input
              type="text"
              id="mileage"
              name="mileage"
              value={formData.mileage}
              onChange={handleChange}
              required
              placeholder="e.g., 125,432"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            />
          </div>

          <div>
            <label htmlFor="fuelLevel" className="block text-sm font-medium text-gray-700 mb-1">
              Fuel Level
            </label>
            <select
              id="fuelLevel"
              name="fuelLevel"
              value={formData.fuelLevel}
              onChange={handleChange}
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            >
              <option value="FULL">Full</option>
              <option value="THREE_QUARTERS">3/4</option>
              <option value="HALF">1/2</option>
              <option value="QUARTER">1/4</option>
              <option value="LOW">Low - Need Fuel</option>
            </select>
          </div>
        </div>

        {/* Conditional Fuel Instructions */}
        {showFuelInstructions && vehicle?.fuelInstructions && (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg animate-fade-in">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-xl">⛽</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Fueling Instructions</h3>
                <div className="mt-2 text-sm text-yellow-700 whitespace-pre-wrap">
                  {vehicle.fuelInstructions}
                </div>
                {vehicle.fuelType && (
                  <p className="mt-1 text-xs font-semibold text-yellow-800">
                    Fuel Type: {vehicle.fuelType}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safety Checks */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          ✅ Safety Inspection
        </h3>

        <div className="space-y-3">
          {[
            { key: "lightsWorking", label: "All lights working (headlights, taillights, signals)" },
            { key: "tiresCondition", label: "Tires in good condition (no visible damage)" },
            { key: "braksWorking", label: "Brakes working properly" },
            { key: "vehicleClean", label: "Vehicle is clean and presentable" },
          ].map((item) => (
            <div key={item.key} className="flex items-center p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id={item.key}
                name={item.key}
                checked={formData[item.key as keyof SimpleSafetyCheckData] as boolean}
                onChange={handleChange}
                required
                className="h-5 w-5 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
              />
              <label htmlFor={item.key} className="ml-3 text-sm text-gray-700 font-medium">
                {item.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment Check */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          🔧 Equipment Check
        </h3>

        <div className="space-y-3">
          {[
            { key: "palletJackWorking", label: "Pallet jack working properly" },
            { key: "dolliesSecured", label: "Dollies secured and in good condition" },
            { key: "strapsAvailable", label: "Straps available and in good condition" },
          ].map((item) => (
            <div key={item.key} className="flex items-center p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id={item.key}
                name={item.key}
                checked={formData[item.key as keyof SimpleSafetyCheckData] as boolean}
                onChange={handleChange}
                required
                className="h-5 w-5 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
              />
              <label htmlFor={item.key} className="ml-3 text-sm text-gray-700 font-medium">
                {item.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Departure */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          📋 Pre-Departure
        </h3>

        <div className="space-y-3">
          {[
            { key: "routeReviewed", label: "Route reviewed and understood" },
            { key: "warehouseContacted", label: "Warehouse contacted if needed" },
          ].map((item) => (
            <div key={item.key} className="flex items-center p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id={item.key}
                name={item.key}
                checked={formData[item.key as keyof SimpleSafetyCheckData] as boolean}
                onChange={handleChange}
                required
                className="h-5 w-5 text-black border-gray-300 rounded focus:ring-black focus:ring-2"
              />
              <label htmlFor={item.key} className="ml-3 text-sm text-gray-700 font-medium">
                {item.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          📝 Additional Notes
        </h3>

        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
          placeholder="Any concerns or additional notes..."
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black hover:bg-gray-800 text-white font-medium py-4 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation mobile-button text-base"
      >
        {isSubmitting ? "Submitting..." : "✅ Complete Start-of-Day Check"}
      </button>
    </form>
  );
}

