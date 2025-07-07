"use client";

import { useState } from "react";

interface SimpleEndOfDayChecklistProps {
  onSubmit: (data: SimpleEndOfDayCheckData) => void;
  isSubmitting: boolean;
}

export interface SimpleEndOfDayCheckData {
  // Exactly the same fields as Start of Day
  date: string;
  truckNumber: string;
  mileage: string;
  fuelLevel: string;
  lightsWorking: boolean;
  tiresCondition: boolean;
  braksWorking: boolean;
  vehicleClean: boolean;
  palletJackWorking: boolean;
  dolliesSecured: boolean;
  strapsAvailable: boolean;
  routeReviewed: boolean;
  warehouseContacted: boolean;
  notes: string;
}

export default function SimpleEndOfDayChecklist({
  onSubmit,
  isSubmitting,
}: SimpleEndOfDayChecklistProps) {
  const [formData, setFormData] = useState<SimpleEndOfDayCheckData>({
    date: new Date().toISOString().split("T")[0],
    truckNumber: "",
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

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
      {/* Basic Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        
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
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            />
          </div>

          <div>
            <label htmlFor="mileage" className="block text-sm font-medium text-gray-700 mb-1">
              Mileage
            </label>
            <input
              type="text"
              id="mileage"
              name="mileage"
              value={formData.mileage}
              onChange={handleChange}
              required
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
              <option value="3/4">3/4</option>
              <option value="1/2">1/2</option>
              <option value="1/4">1/4</option>
              <option value="EMPTY">Empty</option>
            </select>
          </div>
        </div>
      </div>

      {/* Safety Checklist - Exactly same as Start of Day */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Safety Checklist</h3>

        <div className="space-y-3">
          {[
            { key: "lightsWorking", label: "All lights working properly" },
            { key: "tiresCondition", label: "Tires in good condition" },
            { key: "braksWorking", label: "Brakes working properly" },
            { key: "vehicleClean", label: "Vehicle is clean and presentable" },
            { key: "palletJackWorking", label: "Pallet jack working properly" },
            { key: "dolliesSecured", label: "Dollies secured and in good condition" },
            { key: "strapsAvailable", label: "Straps available and in good condition" },
            { key: "routeReviewed", label: "Route reviewed and understood" },
            { key: "warehouseContacted", label: "Warehouse contacted if needed" },
          ].map((item) => (
            <div key={item.key} className="flex items-center p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id={item.key}
                name={item.key}
                checked={formData[item.key as keyof SimpleEndOfDayCheckData] as boolean}
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
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Notes</h3>
        
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            placeholder="Any additional notes or observations..."
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-3 px-8 rounded-lg transition duration-200 touch-manipulation mobile-button"
        >
          {isSubmitting ? "Submitting..." : "Submit Safety Check"}
        </button>
      </div>
    </form>
  );
}
