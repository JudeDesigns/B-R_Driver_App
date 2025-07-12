import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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
  _lastUpdated?: string;
}

/**
 * Custom hook for managing route details data and authentication
 * Extracted from route details page to improve modularity
 */
export function useRouteDetails(routeId: string) {
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [suppressErrors, setSuppressErrors] = useState(false);
  
  const router = useRouter();

  // Initialize authentication
  useEffect(() => {
    // Get the token and role from localStorage/sessionStorage
    let storedToken = localStorage.getItem("token");
    let storedRole = localStorage.getItem("userRole");

    // If not found in localStorage, check sessionStorage
    if (!storedToken) {
      storedToken = sessionStorage.getItem("token");
      storedRole = sessionStorage.getItem("userRole");
    }

    if (!storedToken || !["ADMIN", "SUPER_ADMIN"].includes(storedRole || "")) {
      router.push("/login");
      return;
    }

    setToken(storedToken);
    setUserRole(storedRole);
  }, [router]);

  // Fetch route details
  const fetchRouteDetails = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      console.log("🔍 Fetching route details for:", routeId);

      const response = await fetch(`/api/admin/routes/${routeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      console.log("🔍 Route details response status:", response.status);
      console.log("🔍 Route details content-type:", response.headers.get("content-type"));

      // Check if response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text();
        console.error("🔍 Non-JSON response for route details:", textResponse.substring(0, 200));
        throw new Error("Server returned an invalid response for route details. Please refresh the page.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch route details (${response.status})`);
      }

      const data = await response.json();
      console.log("🔍 Route details loaded successfully");
      setRoute(data);

    } catch (err) {
      console.error("🔍 Error fetching route details:", err);

      let errorMessage = "An error occurred while loading route details";
      if (err instanceof Error) {
        if (err.message.includes("JSON")) {
          errorMessage = "Server response error. Please refresh the page or check server logs.";
        } else {
          errorMessage = err.message;
        }
      }

      // Only set error if we're not suppressing errors (during email operations)
      if (!suppressErrors) {
        setError(errorMessage);
      } else {
        console.log("🔍 Suppressing error during email operation:", errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [token, routeId, suppressErrors]);

  // Fetch route details when token is available
  useEffect(() => {
    if (token) {
      fetchRouteDetails();
    }
  }, [token, fetchRouteDetails]);

  return {
    route,
    setRoute,
    loading,
    error,
    setError,
    token,
    userRole,
    suppressErrors,
    setSuppressErrors,
    fetchRouteDetails,
    refetch: fetchRouteDetails
  };
}
