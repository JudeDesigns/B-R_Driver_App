"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function DriverDashboard() {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [safetyCheckCompleted, setSafetyCheckCompleted] = useState(false);

  useEffect(() => {
    // In a real implementation, this would fetch data from the API
    // For now, we'll just simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
      // Mock data for demonstration
      setRoute(null);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-20">
      <h1 className="text-2xl font-medium text-black text-center mt-6">
        Today's Route
      </h1>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : error ? (
        <div className="text-red-600 text-center p-4">{error}</div>
      ) : route ? (
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Route ID</span>
                <span className="text-sm font-medium">{route.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Date</span>
                <span className="text-sm font-medium">
                  {new Date(route.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Status</span>
                <span className="text-sm font-medium px-3 py-1 bg-gray-100 rounded-full">
                  {route.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Total Stops</span>
                <span className="text-sm font-medium">
                  {route.stops?.length || 0}
                </span>
              </div>
            </div>

            {!safetyCheckCompleted ? (
              <div className="mt-8">
                <div className="border-l-4 border-gray-300 pl-4 py-2 mb-6">
                  <p className="text-sm text-gray-600">
                    You must complete the safety checklist before starting your
                    route.
                  </p>
                </div>
                <Link
                  href="/driver/safety-check"
                  className="w-full block text-center bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200"
                >
                  Complete Safety Checklist
                </Link>
              </div>
            ) : (
              <Link
                href="/driver/route"
                className="w-full block text-center bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 mt-8"
              >
                View Route Details
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <h3 className="mt-4 text-base font-medium text-black">
            No route assigned
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            You don't have any routes assigned for today.
          </p>
        </div>
      )}
    </div>
  );
}
