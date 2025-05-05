"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState("");

  useEffect(() => {
    // In a real implementation, this would fetch data from the API
    // For now, we'll just simulate loading
    const timer = setTimeout(() => {
      setLoading(false);
      // Mock data for demonstration
      setRoutes([]);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-medium text-black">Dashboard</h1>
        <Link
          href="/admin/routes/upload"
          className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded transition duration-200"
        >
          Upload Route
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="border border-gray-200 rounded p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Active Routes
          </h2>
          <p className="text-3xl font-medium text-black">0</p>
        </div>
        <div className="border border-gray-200 rounded p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Active Drivers
          </h2>
          <p className="text-3xl font-medium text-black">0</p>
        </div>
        <div className="border border-gray-200 rounded p-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
            Completed Deliveries
          </h2>
          <p className="text-3xl font-medium text-black">0</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-black">
            Today&apos;s Routes
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : error ? (
            <div className="text-red-600 text-center">{error}</div>
          ) : routes.length === 0 ? (
            <div className="text-gray-500 text-center py-10">
              <p>No active routes found.</p>
              <p className="mt-2">
                <Link
                  href="/admin/routes/upload"
                  className="text-black hover:underline"
                >
                  Upload a route
                </Link>{" "}
                to get started.
              </p>
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stops
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>{/* Routes would be mapped here */}</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
