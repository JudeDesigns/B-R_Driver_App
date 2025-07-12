'use client';

import { formatDate, getStatusBadgeClass } from "@/utils/routeUtils";

interface Route {
  id: string;
  routeNumber: string | null;
  date: string;
  status: string;
  driver: {
    id: string;
    username: string;
    fullName: string | null;
  };
  stops: any[];
}

interface RouteSummaryProps {
  route: Route;
  getStopsGroupedByDriver: () => Record<string, any[]>;
}

export default function RouteSummary({ route, getStopsGroupedByDriver }: RouteSummaryProps) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-900 text-white border-b border-gray-200">
        <h2 className="text-lg font-semibold">Route Summary</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Route Number */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-gray-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-500">
                Route Number
              </h3>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {route.routeNumber || "N/A"}
            </p>
          </div>

          {/* Date */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-gray-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-500">Date</h3>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {formatDate(route.date)}
            </p>
          </div>

          {/* Driver - Hide if it's just a placeholder */}
          {route.driver && route.driver.username !== "Route Admin" && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <svg
                  className="h-5 w-5 text-gray-500 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <h3 className="text-sm font-medium text-gray-500">
                  Driver
                </h3>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {route.driver?.fullName ||
                  route.driver?.username ||
                  "Unknown Driver"}
              </p>
            </div>
          )}

          {/* Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-gray-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-500">
                Status
              </h3>
            </div>
            <span
              className={`px-3 py-1 inline-flex text-sm font-medium rounded-full ${getStatusBadgeClass(
                route.status
              )}`}
            >
              {route.status.replace("_", " ")}
            </span>
          </div>

          {/* Drivers Assigned */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-gray-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-sm font-medium text-gray-500">
                Drivers Assigned
              </h3>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {Object.keys(getStopsGroupedByDriver()).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
