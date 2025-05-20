"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DRIVER"); // Default to driver
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const router = useRouter();

  // Check for login loop detection
  useEffect(() => {
    // If we detect multiple redirects to login page in a short time, it might be a login loop
    const loginAttempts = sessionStorage.getItem("loginAttempts");
    const now = Date.now();
    const lastLoginTime = parseInt(
      sessionStorage.getItem("lastLoginTime") || "0"
    );

    if (now - lastLoginTime < 5000 && loginAttempts) {
      // If less than 5 seconds between redirects to login page, might be a loop
      const attempts = parseInt(loginAttempts) + 1;
      sessionStorage.setItem("loginAttempts", attempts.toString());

      if (attempts >= 3) {
        // After 3 quick redirects, show the debug option
        setError(
          "You seem to be stuck in a login loop. Click the help text below to fix it."
        );
        setShowDebug(true);
      }
    } else {
      // Reset counter if it's been more than 5 seconds
      sessionStorage.setItem("loginAttempts", "1");
    }

    // Update last login time
    sessionStorage.setItem("lastLoginTime", now.toString());
  }, []);

  // Check for existing token and try to refresh it on page load
  useEffect(() => {
    const checkExistingToken = async () => {
      // Check both localStorage and sessionStorage
      const checkStorage = (storage: Storage) => {
        const token = storage.getItem("token");
        const userRole = storage.getItem("userRole");
        const username = storage.getItem("username");
        const userId = storage.getItem("userId");
        const storageType = storage.getItem("storageType");

        return { token, userRole, username, userId, storageType, storage };
      };

      // Try localStorage first, then sessionStorage
      let authData = checkStorage(localStorage);
      if (!authData.token) {
        authData = checkStorage(sessionStorage);
      }

      const { token, userRole, username, userId, storageType, storage } =
        authData;

      // If we have all the necessary auth data
      if (token && userRole && username && userId) {
        setRefreshing(true);

        try {
          // Try to refresh the token
          const response = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log("Token refresh successful for role:", userRole);

            // Clear any existing tokens first to prevent conflicts
            if (userRole === "DRIVER") {
              // For drivers, make sure we're using sessionStorage
              localStorage.removeItem("token");
              localStorage.removeItem("userRole");
              localStorage.removeItem("username");
              localStorage.removeItem("userId");
              localStorage.removeItem("storageType");

              // Update the token in sessionStorage for drivers
              sessionStorage.setItem("token", data.token);
              sessionStorage.setItem("userRole", userRole);
              sessionStorage.setItem("username", username || "");
              sessionStorage.setItem("userId", userId || "");
              sessionStorage.setItem("storageType", "session");
            } else {
              // For admins, use localStorage
              sessionStorage.removeItem("token");
              sessionStorage.removeItem("userRole");
              sessionStorage.removeItem("username");
              sessionStorage.removeItem("userId");
              sessionStorage.removeItem("storageType");

              // Update the token in localStorage for admins
              localStorage.setItem("token", data.token);
              localStorage.setItem("userRole", userRole);
              localStorage.setItem("username", username || "");
              localStorage.setItem("userId", userId || "");
              localStorage.setItem("storageType", "local");
            }

            // Reset login attempts counter
            sessionStorage.removeItem("loginAttempts");
            sessionStorage.removeItem("lastLoginTime");

            // Redirect based on role
            console.log(
              "Redirecting after token refresh to:",
              userRole === "DRIVER" ? "/driver" : "/admin"
            );
            if (userRole === "DRIVER") {
              router.push("/driver");
            } else {
              router.push("/admin");
            }
          } else {
            console.log("Token refresh failed, clearing storage");
            // If refresh fails, clear storage and don't redirect
            storage.removeItem("token");
            storage.removeItem("userRole");
            storage.removeItem("username");
            storage.removeItem("userId");
            storage.removeItem("storageType");

            // Set an error message to inform the user
            setError("Your session has expired. Please sign in again.");
          }
        } catch (error) {
          console.error("Token refresh error:", error);
          // Don't clear storage on network errors
          // This allows the app to work offline

          // Set an error message but don't clear storage
          setError(
            "Network error. Please check your connection and try again."
          );

          // Don't attempt to redirect if there's a network error
          setRefreshing(false);
          return;
        }

        setRefreshing(false);
      }
    };

    checkExistingToken();
  }, [router]);

  // Function to clear all auth data from storage
  const clearAllStorage = () => {
    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("storageType");

    // Clear sessionStorage
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("userId");
    sessionStorage.removeItem("storageType");

    setError("Storage cleared. You can now try logging in again.");
  };

  // Handle login form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // First try to authenticate via the API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid username or password");
      }

      const data = await response.json();

      console.log(
        "Login successful for user:",
        data.user?.username,
        "with role:",
        data.user?.role
      );

      // Validate the response data
      if (!data.token || !data.user || !data.user.role) {
        throw new Error("Invalid response from server");
      }

      try {
        // Store authentication data
        // Use sessionStorage for DRIVER role to allow admin login in another tab
        // This enables testing both roles simultaneously in different tabs
        const storage =
          data.user.role === "DRIVER" ? sessionStorage : localStorage;

        // Clear any existing tokens first to prevent conflicts
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

        // Now set the new token in the appropriate storage
        storage.setItem("token", data.token);
        storage.setItem("userRole", data.user.role);
        storage.setItem("username", data.user.username || "");
        storage.setItem("userId", data.user.id || "");

        // Also store the storage type used
        storage.setItem(
          "storageType",
          data.user.role === "DRIVER" ? "session" : "local"
        );

        // Reset login attempts counter
        sessionStorage.removeItem("loginAttempts");
        sessionStorage.removeItem("lastLoginTime");

        // Redirect based on role
        console.log(
          "Redirecting to:",
          data.user.role === "DRIVER" ? "/driver" : "/admin"
        );

        // Use a timeout to ensure storage is updated before redirect
        setTimeout(() => {
          if (data.user.role === "DRIVER") {
            router.push("/driver");
          } else {
            router.push("/admin");
          }
        }, 100);
      } catch (storageError) {
        console.error("Storage error:", storageError);
        setError("Error saving login information. Please try again.");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "An error occurred during authentication. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-black tracking-tight uppercase">
            B&R FOOD
            <br />
            SERVICES
          </h1>
          <h2 className="text-4xl font-medium mt-12 mb-10">Sign in</h2>
        </div>

        {error && <div className="text-red-600 text-center mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="hidden">
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded focus:outline-none"
            >
              <option value="DRIVER">Driver</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
          </div>

          <div>
            <input
              id="username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded focus:outline-none"
              required
            />
          </div>

          <div>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 border border-gray-200 rounded focus:outline-none"
              required
            />
          </div>

          <div className="text-right">
            <a href="#" className="text-black hover:underline">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading || refreshing}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-4 px-4 rounded transition duration-200"
          >
            {loading
              ? "Signing in..."
              : refreshing
              ? "Refreshing session..."
              : "Sign in"}
          </button>
        </form>

        {/* Debug section - triple click on the logo to show */}
        <div className="mt-8 text-center">
          <p
            className={`text-xs cursor-pointer ${
              error && (error.includes("loop") || error.includes("expired"))
                ? "text-blue-600 font-medium"
                : "text-gray-400"
            }`}
            onClick={() => setShowDebug(!showDebug)}
          >
            {error && (error.includes("loop") || error.includes("expired"))
              ? "Having trouble logging in? Click here for help."
              : "Need help?"}
          </p>

          {showDebug && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg">
              <h3 className="text-sm font-medium mb-2">Debug Options</h3>
              <button
                onClick={clearAllStorage}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded text-sm"
              >
                Clear All Storage & Reset
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Use this if you're stuck in a login loop or having
                authentication issues.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
