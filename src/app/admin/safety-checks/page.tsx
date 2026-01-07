"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EnhancedTable from "@/components/ui/EnhancedTable";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";

interface SafetyCheck {
  id: string;
  type: "START_OF_DAY" | "END_OF_DAY";
  routeId: string;
  driverId: string;
  createdAt: string;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  };
  route: {
    id: string;
    routeNumber: string | null;
    date: string;
  };
  // Enhanced fields
  date: string | null;
  mileage1: string | null;
  mileage2: string | null;
  dieselLevel: string | null;
  palletsIn: number | null;
  palletsOut: number | null;
  dpfLevel: string | null;
  dieselReceipt: boolean | null;
  dollNumber: string | null;
  truckJackNumber: string | null;
  strapLevel: string | null;
  palletJackNumber: string | null;
  truckNumber: string | null;
  dieselAmount: number | null;
  creditCardNumber: string | null;
  fuelCapKeyNumber: string | null;
  creditCardCashAmount: number | null;
  cashBackAmount: number | null;
  frontLightsPhoto: boolean | null;
  electricityBoxPhoto: boolean | null;
  palletsPhoto: boolean | null;
  vehicleConditionVideo: boolean | null;
  calledWarehouse: boolean | null;
  notes: string | null;
  responses: any;
}

export default function SafetyChecksPage() {
  const [safetyChecks, setSafetyChecks] = useState<SafetyCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [filterType, setFilterType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedSafetyCheck, setSelectedSafetyCheck] = useState<SafetyCheck | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const router = useRouter();

  const fetchSafetyChecks = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());

      if (filterType) {
        params.append("type", filterType);
      }

      if (dateFrom) {
        params.append("dateFrom", dateFrom);
      }

      if (dateTo) {
        params.append("dateTo", dateTo);
      }

      const response = await fetch(`/api/admin/safety-checks?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch safety checks");
      }

      const data = await response.json();
      setSafetyChecks(data.safetyChecks || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching safety checks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSafetyChecks();
  }, [router, limit, offset, filterType, dateFrom, dateTo]);

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * limit);
  };

  const handleViewDetails = (safetyCheck: SafetyCheck) => {
    setSelectedSafetyCheck(safetyCheck);
    setShowDetails(true);
  };

  const formatBoolean = (value: boolean | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return value ? "Yes" : "No";
  };

  const renderPhotoProof = (label: string, url: string | null | undefined) => {
    if (!url) return (
      <div className="flex flex-col items-center justify-center p-2 bg-gray-100 rounded border border-gray-200 text-gray-400">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-[10px]">No photo</span>
      </div>
    );

    return (
      <div className="flex flex-col space-y-1">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-gray-50 rounded border border-gray-300 hover:border-blue-500 hover:shadow-md transition-all p-2 group"
        >
          <div className="w-full h-48 flex items-center justify-center bg-white rounded">
            <img
              src={url}
              alt={label}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="text-center mt-2 text-xs text-gray-500 group-hover:text-blue-600 transition-colors">
            📸 Click to view full size
          </div>
        </a>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-black">Safety Checks</h1>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200">
          <h2 className="text-lg font-medium text-mono-800">Safety Check List</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">All Types</option>
                <option value="START_OF_DAY">Start of Day</option>
                <option value="END_OF_DAY">End of Day</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col min-h-[500px]">
            <div className="flex-grow">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
                </div>
              ) : safetyChecks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No safety checks found matching your criteria.
                </div>
              ) : (
                <EnhancedTable
                  data={safetyChecks}
                  keyField="id"
                  columns={[
                    {
                      header: "Type",
                      accessor: (check) =>
                        check.type === "START_OF_DAY" ? "Start of Day" : "End of Day",
                    },
                    {
                      header: "Driver",
                      accessor: (check) =>
                        check.driver.fullName || check.driver.username,
                    },
                    {
                      header: "Route",
                      accessor: (check) =>
                        check.route.routeNumber
                          ? `Route ${check.route.routeNumber}`
                          : `Route from ${new Date(check.route.date).toLocaleDateString()}`,
                    },
                    {
                      header: "Date Submitted",
                      accessor: (check) =>
                        new Date(check.createdAt).toLocaleString(),
                    },
                    {
                      header: "Actions",
                      accessor: (check) => (
                        <button
                          onClick={() => handleViewDetails(check)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                        >
                          View Details
                        </button>
                      ),
                      align: "right",
                    },
                  ]}
                  striped
                  stickyHeader
                />
              )}
            </div>
          </div>

          {total > limit && (
            <div className="mt-4">
              <Pagination
                totalItems={total}
                itemsPerPage={limit}
                currentPage={Math.floor(offset / limit) + 1}
                onPageChange={handlePageChange}
                onItemsPerPageChange={(newLimit) => {
                  setLimit(newLimit);
                  setOffset(0);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Safety Check Details Modal */}
      {showDetails && selectedSafetyCheck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-gray-900">
                {selectedSafetyCheck.type === "START_OF_DAY" ? "Start of Day" : "End of Day"} Safety Check Details
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Basic Information
                </h4>
                <div className="space-y-2">
                  <p><span className="font-medium">Driver:</span> {selectedSafetyCheck.driver.fullName || selectedSafetyCheck.driver.username}</p>
                  <p><span className="font-medium">Route:</span> {selectedSafetyCheck.route.routeNumber
                    ? `Route ${selectedSafetyCheck.route.routeNumber}`
                    : `Route from ${new Date(selectedSafetyCheck.route.date).toLocaleDateString()}`}</p>
                  <p><span className="font-medium">Submitted:</span> {new Date(selectedSafetyCheck.createdAt).toLocaleString()}</p>
                  <p><span className="font-medium">Check Type:</span> {selectedSafetyCheck.type === "START_OF_DAY" ? "Start of Day" : "End of Day"}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Vehicle Information
                </h4>
                <div className="space-y-2">
                  <p><span className="font-medium">Truck Number:</span> {selectedSafetyCheck.truckNumber || "N/A"}</p>
                  <p><span className="font-medium">Mileage Start:</span> {selectedSafetyCheck.mileage1 || "N/A"}</p>
                  <p><span className="font-medium">Mileage End:</span> {selectedSafetyCheck.mileage2 || "N/A"}</p>
                  <p><span className="font-medium">Diesel Level:</span> {selectedSafetyCheck.dieselLevel || "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Equipment Information
                </h4>
                <div className="space-y-2">
                  <p><span className="font-medium">Doll Number:</span> {selectedSafetyCheck.dollNumber || "N/A"}</p>
                  <p><span className="font-medium">Truck Jack Number:</span> {selectedSafetyCheck.truckJackNumber || "N/A"}</p>
                  <p><span className="font-medium">Pallet Jack Number:</span> {selectedSafetyCheck.palletJackNumber || "N/A"}</p>
                  <p><span className="font-medium">Strap Level:</span> {selectedSafetyCheck.strapLevel || "N/A"}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Fuel Information
                </h4>
                <div className="space-y-2">
                  <p><span className="font-medium">Diesel Amount:</span> {selectedSafetyCheck.dieselAmount !== null ? selectedSafetyCheck.dieselAmount : "N/A"}</p>
                  <p><span className="font-medium">Credit Card Number:</span> {selectedSafetyCheck.creditCardNumber || "N/A"}</p>
                  <p><span className="font-medium">Fuel Cap Key Number:</span> {selectedSafetyCheck.fuelCapKeyNumber || "N/A"}</p>
                  <p><span className="font-medium">Credit Card Cash Amount:</span> {selectedSafetyCheck.creditCardCashAmount !== null ? `$${selectedSafetyCheck.creditCardCashAmount}` : "N/A"}</p>
                  <p><span className="font-medium">Cash Back Amount:</span> {selectedSafetyCheck.cashBackAmount !== null ? `$${selectedSafetyCheck.cashBackAmount}` : "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Safety Verification
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p><span className="font-medium">Front Lights Photo:</span> {formatBoolean(selectedSafetyCheck.frontLightsPhoto)}</p>
                <p><span className="font-medium">Electricity Box Photo:</span> {formatBoolean(selectedSafetyCheck.electricityBoxPhoto)}</p>
                <p><span className="font-medium">Pallets Photo:</span> {formatBoolean(selectedSafetyCheck.palletsPhoto)}</p>
                <p><span className="font-medium">Vehicle Condition Video:</span> {formatBoolean(selectedSafetyCheck.vehicleConditionVideo)}</p>
                <p><span className="font-medium">Called Warehouse:</span> {formatBoolean(selectedSafetyCheck.calledWarehouse)}</p>
              </div>
            </div>

            {/* New Route Procedure Updates */}
            {selectedSafetyCheck.responses && (
              <div className="border-t pt-6 mt-6">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Route Procedure Documentation</h4>

                {selectedSafetyCheck.type === "START_OF_DAY" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-semibold text-blue-800 mb-2">Printer & Supplies</h5>
                      <div className="space-y-2 text-sm p-3 bg-blue-50 rounded">
                        <p><span className="font-medium">Printer Test:</span> {formatBoolean(selectedSafetyCheck.responses.printerTestDone)}</p>
                        <p><span className="font-medium">Has Copy Paper:</span> {formatBoolean(selectedSafetyCheck.responses.hasCopyPaper)}</p>
                        <p><span className="font-medium">Has Staples:</span> {formatBoolean(selectedSafetyCheck.responses.hasStaples)}</p>
                        <p><span className="font-medium">Has Stapler:</span> {formatBoolean(selectedSafetyCheck.responses.hasStapler)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {renderPhotoProof("Printer Test Proof", selectedSafetyCheck.responses.printerTestPhotoUrl)}
                      {renderPhotoProof("Route Equipment", selectedSafetyCheck.responses.equipmentPhotoUrl)}
                    </div>
                    <div className="col-span-full">
                      <h5 className="font-semibold text-gray-800 mb-2">Truck Exterior Proof</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderPhotoProof("Front", selectedSafetyCheck.responses.exteriorFrontPhotoUrl)}
                        {renderPhotoProof("Back", selectedSafetyCheck.responses.exteriorBackPhotoUrl)}
                        {renderPhotoProof("Left", selectedSafetyCheck.responses.exteriorLeftPhotoUrl)}
                        {renderPhotoProof("Right", selectedSafetyCheck.responses.exteriorRightPhotoUrl)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {renderPhotoProof("Equipment (End)", selectedSafetyCheck.responses.equipmentCheckPhotoUrl)}
                      {renderPhotoProof("Power Converter (OFF)", selectedSafetyCheck.responses.powerConverterPhotoUrl)}
                      {renderPhotoProof("Dashboard Info", selectedSafetyCheck.responses.dashboardPhotoUrl)}
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">Truck Exterior Proof (End)</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {renderPhotoProof("Front", selectedSafetyCheck.responses.exteriorFrontPhotoUrl)}
                        {renderPhotoProof("Back", selectedSafetyCheck.responses.exteriorBackPhotoUrl)}
                        {renderPhotoProof("Left", selectedSafetyCheck.responses.exteriorLeftPhotoUrl)}
                        {renderPhotoProof("Right", selectedSafetyCheck.responses.exteriorRightPhotoUrl)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedSafetyCheck.notes && (
              <div className="mb-6 mt-6">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Additional Notes
                </h4>
                <div className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedSafetyCheck.notes}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
