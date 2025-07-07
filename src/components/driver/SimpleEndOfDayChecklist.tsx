"use client";

import { useState } from "react";

interface SimpleEndOfDayChecklistProps {
  onSubmit: (data: SimpleEndOfDayCheckData) => void;
  isSubmitting: boolean;
  routeDate?: string; // Optional route date to pre-fill the date field
}

export interface SimpleEndOfDayCheckData {
  // Basic vehicle check
  date: string;
  truckNumber: string;
  finalMileage: string;
  fuelLevel: string;
  
  // End of day safety items
  vehicleSecured: boolean;
  lightsOff: boolean;
  equipmentStored: boolean;
  vehicleClean: boolean;
  
  // Equipment check
  palletJackSecured: boolean;
  dolliesStored: boolean;
  strapsStored: boolean;
  
  // End of day tasks
  deliveriesCompleted: boolean;
  documentsSubmitted: boolean;
  
  // Notes
  notes: string;
}

export default function SimpleEndOfDayChecklist({
  onSubmit,
  isSubmitting,
  routeDate,
}: SimpleEndOfDayChecklistProps) {
  const [formData, setFormData] = useState<SimpleEndOfDayCheckData>({
    date: routeDate || new Date().toISOString().split("T")[0],
    truckNumber: "",
    finalMileage: "",
    fuelLevel: "FULL",
    vehicleSecured: false,
    lightsOff: false,
    equipmentStored: false,
    vehicleClean: false,
    palletJackSecured: false,
    dolliesStored: false,
    strapsStored: false,
    deliveriesCompleted: false,
    documentsSubmitted: false,
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
            <label htmlFor="finalMileage" className="block text-sm font-medium text-gray-700 mb-1">
              Final Mileage
            </label>
            <input
              type="text"
              id="finalMileage"
              name="finalMileage"
              value={formData.finalMileage}
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

      {/* Vehicle Security Check */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Vehicle Security</h3>
        
        <div className="space-y-3">
          {[
            { key: "vehicleSecured", label: "Vehicle properly secured and locked" },
            { key: "lightsOff", label: "All lights turned off" },
            { key: "equipmentStored", label: "All equipment properly stored" },
            { key: "vehicleClean", label: "Vehicle cleaned and organized" },
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

      {/* Equipment Storage */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Equipment Storage</h3>
        
        <div className="space-y-3">
          {[
            { key: "palletJackSecured", label: "Pallet jack secured and stored" },
            { key: "dolliesStored", label: "Dollies properly stored" },
            { key: "strapsStored", label: "Straps organized and stored" },
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

      {/* End of Day Tasks */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">End of Day Tasks</h3>
        
        <div className="space-y-3">
          {[
            { key: "deliveriesCompleted", label: "All deliveries completed successfully" },
            { key: "documentsSubmitted", label: "All required documents submitted" },
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
          {isSubmitting ? "Submitting..." : "Complete End-of-Day Check"}
        </button>
      </div>
    </form>
  );
}
