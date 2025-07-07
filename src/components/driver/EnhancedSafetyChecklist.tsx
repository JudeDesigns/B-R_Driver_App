"use client";

import { useState } from "react";

interface EnhancedSafetyChecklistProps {
  onSubmit: (data: SafetyCheckData) => void;
  isSubmitting: boolean;
  checklistType: "START_OF_DAY" | "END_OF_DAY";
}

export interface SafetyCheckData {
  // Vehicle & Fuel Check fields
  date: string;
  mileage1: string;
  mileage2: string;
  dieselLevel: string;
  palletsIn: number;
  palletsOut: number;
  dpfLevel: string;
  dieselReceipt: boolean;
  dollNumber: string;
  truckJackNumber: string;
  strapLevel: string;
  palletJackNumber: string;
  truckNumber: string;

  // Fueling Details
  dieselAmount: number;
  creditCardNumber: string;
  fuelCapKeyNumber: string;
  creditCardCashAmount: number;
  cashBackAmount: number;

  // Photo/Video Upload Checklist
  frontLightsPhoto: boolean;
  electricityBoxPhoto: boolean;
  palletsPhoto: boolean;
  vehicleConditionVideo: boolean;
  calledWarehouse: boolean;

  // Additional fields
  notes: string;
}

export default function EnhancedSafetyChecklist({
  onSubmit,
  isSubmitting,
  checklistType,
}: EnhancedSafetyChecklistProps) {
  // Initialize form state with default values
  const [formData, setFormData] = useState<SafetyCheckData>({
    // Vehicle & Fuel Check fields
    date: new Date().toISOString().split("T")[0],
    mileage1: "",
    mileage2: "",
    dieselLevel: "FULL",
    palletsIn: 0,
    palletsOut: 0,
    dpfLevel: "",
    dieselReceipt: false,
    dollNumber: "",
    truckJackNumber: "",
    strapLevel: "",
    palletJackNumber: "",
    truckNumber: "",

    // Fueling Details
    dieselAmount: 0,
    creditCardNumber: "",
    fuelCapKeyNumber: "",
    creditCardCashAmount: 0,
    cashBackAmount: 0,

    // Photo/Video Upload Checklist
    frontLightsPhoto: false,
    electricityBoxPhoto: false,
    palletsPhoto: false,
    vehicleConditionVideo: false,
    calledWarehouse: false,

    // Additional fields
    notes: "",
  });

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else if (type === "number") {
      setFormData((prev) => ({
        ...prev,
        [name]: parseFloat(value) || 0,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Vehicle & Fuel Check Section */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          Vehicle & Fuel Check
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
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
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            />
          </div>

          <div>
            <label
              htmlFor="mileage1"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              MIL #1
            </label>
            <input
              type="text"
              id="mileage1"
              name="mileage1"
              value={formData.mileage1}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="mileage2"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              MIL #2
            </label>
            <input
              type="text"
              id="mileage2"
              name="mileage2"
              value={formData.mileage2}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="dieselLevel"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Diesel Level
            </label>
            <select
              id="dieselLevel"
              name="dieselLevel"
              value={formData.dieselLevel}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="FULL">Full</option>
              <option value="THREE_QUARTERS">3/4</option>
              <option value="HALF">1/2</option>
              <option value="QUARTER">1/4</option>
              <option value="EMPTY">Empty</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="palletsIn"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Pallets IN
            </label>
            <input
              type="number"
              id="palletsIn"
              name="palletsIn"
              value={formData.palletsIn}
              onChange={handleChange}
              required
              min="0"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="palletsOut"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Pallets OUT
            </label>
            <input
              type="number"
              id="palletsOut"
              name="palletsOut"
              value={formData.palletsOut}
              onChange={handleChange}
              required
              min="0"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="dpfLevel"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              DPF Level
            </label>
            <input
              type="text"
              id="dpfLevel"
              name="dpfLevel"
              value={formData.dpfLevel}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center h-full pt-6">
            <input
              type="checkbox"
              id="dieselReceipt"
              name="dieselReceipt"
              checked={formData.dieselReceipt}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="dieselReceipt"
              className="ml-2 block text-sm text-gray-700"
            >
              Diesel Receipt
            </label>
          </div>

          <div>
            <label
              htmlFor="dollNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Doll #
            </label>
            <input
              type="text"
              id="dollNumber"
              name="dollNumber"
              value={formData.dollNumber}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="truckJackNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Truck Jack #
            </label>
            <input
              type="text"
              id="truckJackNumber"
              name="truckJackNumber"
              value={formData.truckJackNumber}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="strapLevel"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Strap Level
            </label>
            <input
              type="text"
              id="strapLevel"
              name="strapLevel"
              value={formData.strapLevel}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="palletJackNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Pallet Jack #
            </label>
            <input
              type="text"
              id="palletJackNumber"
              name="palletJackNumber"
              value={formData.palletJackNumber}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="truckNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Truck #
            </label>
            <input
              type="text"
              id="truckNumber"
              name="truckNumber"
              value={formData.truckNumber}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Fueling Details Section */}
      <div className="space-y-6">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          Fueling Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="dieselAmount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Diesel Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="dieselAmount"
                name="dieselAmount"
                value={formData.dieselAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full p-2 pl-7 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="creditCardNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Credit Card No.
            </label>
            <input
              type="text"
              id="creditCardNumber"
              name="creditCardNumber"
              value={formData.creditCardNumber}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="fuelCapKeyNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Key for Fuel Cap #
            </label>
            <input
              type="text"
              id="fuelCapKeyNumber"
              name="fuelCapKeyNumber"
              value={formData.fuelCapKeyNumber}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="creditCardCashAmount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Credit Card / Cash Receive Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="creditCardCashAmount"
                name="creditCardCashAmount"
                value={formData.creditCardCashAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full p-2 pl-7 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cashBackAmount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cash Back Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                id="cashBackAmount"
                name="cashBackAmount"
                value={formData.cashBackAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="w-full p-2 pl-7 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Photo/Video Upload Checklist Section */}
      <div className="space-y-6">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          Photo/Video Upload Checklist
        </h3>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="frontLightsPhoto"
              name="frontLightsPhoto"
              checked={formData.frontLightsPhoto}
              onChange={handleChange}
              required
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="frontLightsPhoto"
              className="ml-2 block text-sm text-gray-700"
            >
              Upload photo of front lights/tail lights
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="electricityBoxPhoto"
              name="electricityBoxPhoto"
              checked={formData.electricityBoxPhoto}
              onChange={handleChange}
              required
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="electricityBoxPhoto"
              className="ml-2 block text-sm text-gray-700"
            >
              Upload photo of electricity box (power off)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="palletsPhoto"
              name="palletsPhoto"
              checked={formData.palletsPhoto}
              onChange={handleChange}
              required
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="palletsPhoto"
              className="ml-2 block text-sm text-gray-700"
            >
              Upload photo of pallets/dolly/pallet jack
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="vehicleConditionVideo"
              name="vehicleConditionVideo"
              checked={formData.vehicleConditionVideo}
              onChange={handleChange}
              required
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="vehicleConditionVideo"
              className="ml-2 block text-sm text-gray-700"
            >
              Upload video of vehicle condition
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="calledWarehouse"
              name="calledWarehouse"
              checked={formData.calledWarehouse}
              onChange={handleChange}
              required
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="calledWarehouse"
              className="ml-2 block text-sm text-gray-700"
            >
              Called warehouse before leaving for last assignments
            </label>
          </div>
        </div>
      </div>

      {/* Additional Notes Section */}
      <div className="space-y-4">
        <h3 className="text-base font-medium text-gray-900 border-b pb-2 mobile-heading">
          Additional Notes
        </h3>

        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
          placeholder="Enter any additional notes or concerns here..."
        ></textarea>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation mobile-button"
      >
        {isSubmitting
          ? "Submitting..."
          : `Submit ${
              checklistType === "START_OF_DAY" ? "Start-of-Day" : "End-of-Day"
            } Checklist`}
      </button>
    </form>
  );
}
