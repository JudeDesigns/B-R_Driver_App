"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const [safetyCheckCompleted, setSafetyCheckCompleted] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in and has driver role
    try {
      // Check both localStorage and sessionStorage, with preference for sessionStorage for drivers
      let storedToken, userRole, storedUsername;

      // First check sessionStorage (preferred for drivers)
      storedToken = sessionStorage.getItem("token");
      userRole = sessionStorage.getItem("userRole");
      storedUsername = sessionStorage.getItem("username");

      // If not found in sessionStorage, check localStorage
      if (!storedToken) {
        storedToken = localStorage.getItem("token");
        userRole = localStorage.getItem("userRole");
        storedUsername = localStorage.getItem("username");
      }

      if (!storedToken || userRole !== "DRIVER") {
        router.push("/login");
        return;
      }

      setToken(storedToken);

      // Use the stored username directly instead of trying to decode the token
      if (storedUsername) {
        setUsername(storedUsername);
      } else {
        setUsername("Driver");
      }
    } catch (error) {
      console.error("Error in auth check:", error);
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    if (token) {
      checkSafetyStatus();
    }
  }, [token]);

  const checkSafetyStatus = async () => {
    if (!token) return;

    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      const response = await fetch(
        `/api/driver/safety-check/status?date=${today}&t=${Date.now()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSafetyCheckCompleted(data.hasCompletedChecks || false);
      }
    } catch (error) {
      console.error("Error checking safety status:", error);
    }
  };



  const handleLogout = () => {
    // Clear both localStorage and sessionStorage
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("storageType");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("storageType");

    console.log("Driver logged out successfully from layout");
    // Force a page reload to clear any cached state
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-white prevent-pull-refresh">
      {/* Header - Simplified and Mobile Optimized */}
      <header className="border-b border-gray-200 mobile-header">
        <div className="container mx-auto px-4 py-3 flex justify-center items-center">
          <h1 className="text-xl font-bold uppercase tracking-tight">
            B&R FOOD SERVICES
          </h1>
        </div>
      </header>

      {/* Main Content - Mobile Optimized */}
      <main className="flex-1 p-4 pb-24 mobile-container">{children}</main>

      {/* Mobile Navigation - Optimized */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full mobile-nav">
        <div className="flex justify-around">
          <Link
            href="/driver"
            className="flex flex-col items-center py-3 px-4 text-gray-600 hover:text-black touch-manipulation tap-target"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-xs mt-1">Home</span>
          </Link>

          <Link
            href="/driver/stops"
            className="flex flex-col items-center py-3 px-4 text-gray-600 hover:text-black touch-manipulation tap-target"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-xs mt-1">Stops</span>
          </Link>

          <Link
            href="/driver/end-of-day"
            className="flex flex-col items-center py-3 px-4 text-gray-600 hover:text-black touch-manipulation tap-target"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-xs mt-1">End Day</span>
          </Link>



          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center py-3 px-4 text-gray-600 hover:text-black"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="text-xs mt-1">Logout</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
