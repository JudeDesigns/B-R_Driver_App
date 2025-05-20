"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  _count: {
    stops: number;
  };
  completionPercentage: number;
  completedStops: number;
  totalStops: number;
}

export default function TodaysRoutesSidebar() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    fetchTodaysRoutes();
  }, []);

  const fetchTodaysRoutes = async () => {
    setLoading(true);
    setError("");

    try {
      // Get token from localStorage
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No token found in localStorage");
        throw new Error("Authentication token not found");
      }

      console.log("Fetching today's routes...");

      // Fetch today's routes using the dedicated API endpoint
      const response = await fetch("/api/admin/routes/today", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Response status:", response.status);

      // Get the raw text first for debugging
      const responseText = await response.text();
      console.log("Response text:", responseText);

      // If it's not JSON, we'll catch the error below
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse JSON:", parseError);
        throw new Error("Invalid response format from server");
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch routes");
      }

      console.log("Routes data:", data.routes);
      setRoutes(data.routes || []);
    } catch (err) {
      console.error("Error fetching today's routes:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Always show the menu item, even if there are no routes
  // This helps with debugging and provides better UX

  return (
    <li>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group hover:bg-gray-800"
      >
        <div className="flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-3 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <span className="font-medium group-hover:translate-x-1 transition-all duration-300">
            Today&apos;s Routes
          </span>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-1 ml-4 space-y-1">
          {loading ? (
            <div className="py-2 px-4 text-gray-400 text-sm">
              Loading routes...
            </div>
          ) : error ? (
            <div className="py-2 px-4 text-red-400 text-sm">
              Error loading routes
            </div>
          ) : (
            routes.map((route) => (
              <Link
                key={route.id}
                href={`/admin/routes/${route.id}`}
                className={`flex flex-col py-2 px-4 pl-8 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                  pathname === `/admin/routes/${route.id}`
                    ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                    : "hover:bg-gray-800"
                }`}
              >
                {pathname === `/admin/routes/${route.id}` && (
                  <span className="absolute left-0 top-0 h-full w-1 bg-green-500"></span>
                )}
                <span
                  className={`absolute inset-0 w-1 bg-green-500 transition-all duration-300 ${
                    pathname === `/admin/routes/${route.id}`
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                ></span>
                <div className="flex justify-between items-center w-full">
                  <span
                    className={`text-sm font-medium transition-all duration-300 ${
                      pathname === `/admin/routes/${route.id}`
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    {route.routeNumber
                      ? `Route ${route.routeNumber}`
                      : `Route #${route.id.substring(0, 8)}`}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      route.completionPercentage === 100
                        ? "bg-green-500 text-white"
                        : route.completionPercentage > 50
                        ? "bg-yellow-500 text-white"
                        : "bg-gray-600 text-white"
                    }`}
                  >
                    {route.completionPercentage}%
                  </span>
                </div>
                <div className="mt-1 flex justify-between items-center w-full">
                  <span className="text-xs text-gray-400">
                    {route.completedStops}/{route.totalStops} stops
                  </span>
                  <span className="text-xs text-gray-400">
                    {route.driver?.fullName ||
                      route.driver?.username ||
                      "No driver"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </li>
  );
}
