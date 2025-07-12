'use client';

import StatusButton from "../StatusButton";

interface Stop {
  status: string;
  arrivalTime: string | null;
  completionTime: string | null;
}

interface StatusUpdateCardProps {
  stop: Stop;
  updatingStatus: boolean;
  deliveryTimer: number | null;
  isStatusButtonDisabled: (status: string) => boolean;
  updateStatus: (status: string) => void;
  formatDate: (date: string | null) => string;
}

export default function StatusUpdateCard({
  stop,
  updatingStatus,
  deliveryTimer,
  isStatusButtonDisabled,
  updateStatus,
  formatDate
}: StatusUpdateCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900">
          Delivery Status
        </h2>
      </div>
      <div className="p-4 sm:p-5">
        {/* Progress Indicator - Mobile Optimized */}
        <div className="relative mb-6 sm:mb-8">
          <div className="overflow-hidden h-2 mb-3 sm:mb-4 text-xs flex rounded bg-gray-200">
            <div
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                stop.status === "PENDING"
                  ? "bg-gray-400 w-0"
                  : stop.status === "ON_THE_WAY"
                  ? "bg-blue-500 w-1/3"
                  : stop.status === "ARRIVED"
                  ? "bg-yellow-500 w-2/3"
                  : "bg-green-500 w-full"
              }`}
            ></div>
          </div>
          <div className="flex justify-between">
            <div
              className={`text-xs font-medium ${
                stop.status === "PENDING"
                  ? "text-gray-900"
                  : "text-gray-500"
              }`}
            >
              Pending
            </div>
            <div
              className={`text-xs font-medium ${
                stop.status === "ON_THE_WAY"
                  ? "text-blue-600"
                  : "text-gray-500"
              }`}
            >
              <span className="hidden xs:inline">On The Way</span>
              <span className="xs:hidden">On Way</span>
            </div>
            <div
              className={`text-xs font-medium ${
                stop.status === "ARRIVED"
                  ? "text-yellow-600"
                  : "text-gray-500"
              }`}
            >
              Arrived
            </div>
            <div
              className={`text-xs font-medium ${
                stop.status === "COMPLETED"
                  ? "text-green-600"
                  : "text-gray-500"
              }`}
            >
              Done
            </div>
          </div>
        </div>

        {/* Status Buttons - Mobile Optimized */}
        <div className="flex flex-col space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <StatusButton
              status={stop.status}
              targetStatus="ON_THE_WAY"
              currentStatus="PENDING"
              isUpdating={updatingStatus}
              isDisabled={isStatusButtonDisabled("ON_THE_WAY")}
              onClick={() => updateStatus("ON_THE_WAY")}
              label="Start Delivery"
              className="h-10 sm:h-12 text-sm sm:text-base touch-manipulation mobile-button"
            />
            <StatusButton
              status={stop.status}
              targetStatus="ARRIVED"
              currentStatus="ON_THE_WAY"
              isUpdating={updatingStatus}
              isDisabled={isStatusButtonDisabled("ARRIVED")}
              onClick={() => updateStatus("ARRIVED")}
              label="Mark as Arrived"
              className="h-10 sm:h-12 text-sm sm:text-base touch-manipulation mobile-button"
            />
          </div>
          {/* Complete Delivery button removed - now handled by the InvoiceUpload component */}
        </div>

        {/* Delivery Timer - Mobile Optimized */}
        {deliveryTimer !== null && (
          <div className="mt-5 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-center">
              <svg
                className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-1.5 sm:mr-2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="text-sm font-medium text-blue-800">
                {stop.status === "ON_THE_WAY"
                  ? "Delivery Time"
                  : stop.status === "ARRIVED"
                  ? "Travel Duration"
                  : "Service Duration"}
              </h3>
            </div>
            <div className="mt-2 text-center">
              <div className="text-xl sm:text-2xl font-bold text-blue-700">
                {Math.floor(deliveryTimer / 3600)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor((deliveryTimer % 3600) / 60)
                  .toString()
                  .padStart(2, "0")}
                :
                {Math.floor(deliveryTimer % 60)
                  .toString()
                  .padStart(2, "0")}
              </div>
              <p className="text-xs text-blue-600 mt-1">
                {stop.status === "ON_THE_WAY"
                  ? "Time since starting delivery"
                  : stop.status === "ARRIVED"
                  ? "Time from start to arrival"
                  : "Time at customer location"}
              </p>
            </div>
          </div>
        )}

        {/* Timestamps - Mobile Optimized */}
        <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-4">
          <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
              Arrival Time
            </span>
            <p className="font-medium text-gray-900 mt-1 text-sm sm:text-base truncate">
              {formatDate(stop.arrivalTime)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 sm:p-3">
            <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
              Completion Time
            </span>
            <p className="font-medium text-gray-900 mt-1 text-sm sm:text-base truncate">
              {formatDate(stop.completionTime)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
