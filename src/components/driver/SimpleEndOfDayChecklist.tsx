import { useState } from "react";
import SafetyPhotoBox from "./SafetyPhotoBox";

interface SimpleEndOfDayChecklistProps {
  onSubmit: (data: SimpleEndOfDayCheckData) => void;
  isSubmitting: boolean;
  routeId?: string;
}

export interface SimpleEndOfDayCheckData {
  // Exactly the same fields as Start of Day
  date: string;
  truckNumber: string;
  mileage: string;
  fuelLevel: string;
  odometerEnd: string; // Ending odometer reading for KPI tracking

  // Post-Trip Documentation
  equipmentCheckPhotoUrl?: string; // dollies, pallet jacks, empty pallets
  powerConverterPhotoUrl?: string; // power converter OFF
  dashboardPhotoUrl?: string; // fuel, engine light, DEF

  // Truck Exterior
  exteriorFrontPhotoUrl?: string;
  exteriorBackPhotoUrl?: string;
  exteriorLeftPhotoUrl?: string;
  exteriorRightPhotoUrl?: string;

  notes: string;
}

export default function SimpleEndOfDayChecklist({
  onSubmit,
  isSubmitting,
  routeId,
}: SimpleEndOfDayChecklistProps) {
  const [formData, setFormData] = useState<SimpleEndOfDayCheckData>({
    date: new Date().toISOString().split("T")[0],
    truckNumber: "",
    mileage: "",
    fuelLevel: "FULL",
    odometerEnd: "",
    equipmentCheckPhotoUrl: "",
    powerConverterPhotoUrl: "",
    dashboardPhotoUrl: "",
    exteriorFrontPhotoUrl: "",
    exteriorBackPhotoUrl: "",
    exteriorLeftPhotoUrl: "",
    exteriorRightPhotoUrl: "",
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

          <div>
            <label htmlFor="odometerEnd" className="block text-sm font-medium text-gray-700 mb-1">
              Ending Odometer <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="odometerEnd"
              name="odometerEnd"
              value={formData.odometerEnd}
              onChange={handleChange}
              required
              placeholder="e.g., 125650"
              min="0"
              step="0.1"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent mobile-input"
            />
            <p className="text-xs text-gray-500 mt-1">
              📊 Used for daily mileage tracking
            </p>
          </div>
        </div>
      </div>


      {/* Post-Trip Documentation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">📸 Post-Trip Documentation</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SafetyPhotoBox
            label="Equipment (Dollies, Pallet Jacks, Pallets)"
            type="end_equipment"
            routeId={routeId || ""}
            onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, equipmentCheckPhotoUrl: url }))}
            required
            currentUrl={formData.equipmentCheckPhotoUrl}
          />
          <SafetyPhotoBox
            label="Power Converter (Showing OFF status)"
            type="end_power_converter"
            routeId={routeId || ""}
            onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, powerConverterPhotoUrl: url }))}
            required
            currentUrl={formData.powerConverterPhotoUrl}
          />
          <SafetyPhotoBox
            label="Dashboard (Fuel, Engine Light, DEF)"
            type="end_dashboard"
            routeId={routeId || ""}
            onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, dashboardPhotoUrl: url }))}
            required
            currentUrl={formData.dashboardPhotoUrl}
          />
        </div>

        <div className="space-y-4 pt-4">
          <h4 className="text-sm font-medium text-gray-700">Truck Exterior (All 4 Sides)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SafetyPhotoBox
              label="Front Side"
              type="end_exterior_front"
              routeId={routeId || ""}
              onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, exteriorFrontPhotoUrl: url }))}
              required
              currentUrl={formData.exteriorFrontPhotoUrl}
            />
            <SafetyPhotoBox
              label="Back Side"
              type="end_exterior_back"
              routeId={routeId || ""}
              onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, exteriorBackPhotoUrl: url }))}
              required
              currentUrl={formData.exteriorBackPhotoUrl}
            />
            <SafetyPhotoBox
              label="Left Side"
              type="end_exterior_left"
              routeId={routeId || ""}
              onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, exteriorLeftPhotoUrl: url }))}
              required
              currentUrl={formData.exteriorLeftPhotoUrl}
            />
            <SafetyPhotoBox
              label="Right Side"
              type="end_exterior_right"
              routeId={routeId || ""}
              onUploadSuccess={(url: string) => setFormData(prev => ({ ...prev, exteriorRightPhotoUrl: url }))}
              required
              currentUrl={formData.exteriorRightPhotoUrl}
            />
          </div>
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
          disabled={
            isSubmitting ||
            !formData.equipmentCheckPhotoUrl ||
            !formData.powerConverterPhotoUrl ||
            !formData.dashboardPhotoUrl ||
            !formData.exteriorFrontPhotoUrl ||
            !formData.exteriorBackPhotoUrl ||
            !formData.exteriorLeftPhotoUrl ||
            !formData.exteriorRightPhotoUrl
          }
          className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium py-4 px-8 rounded-lg transition duration-200 touch-manipulation mobile-button text-lg"
        >
          {isSubmitting ? "Submitting..." : "🏁 Complete End-of-Day Check"}
        </button>
      </div>
    </form>
  );
}
