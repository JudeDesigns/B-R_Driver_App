import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AuthState {
  token: string | null;
  userRole: string | null;
  userId: string | null;
  username: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface UseAuthOptions {
  requiredRole?: string | string[];
  redirectTo?: string;
  allowedRoles?: string[];
}

export function useAuth(options: UseAuthOptions = {}) {
  const {
    requiredRole,
    redirectTo = "/login",
    allowedRoles = ["ADMIN", "SUPER_ADMIN", "DRIVER"],
  } = options;

  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    userRole: null,
    userId: null,
    username: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();

  // Memoize the redirect function to prevent unnecessary re-renders
  const handleRedirect = useCallback((redirectPath: string) => {
    setTimeout(() => {
      router.push(redirectPath);
    }, 100);
  }, [router]);

  useEffect(() => {
    const checkAuth = () => {
      try {
        // Check localStorage first, then sessionStorage
        let storedToken = localStorage.getItem("token");
        let storedRole = localStorage.getItem("userRole");
        let storedUserId = localStorage.getItem("userId");
        let storedUsername = localStorage.getItem("username");

        if (!storedToken) {
          storedToken = sessionStorage.getItem("token");
          storedRole = sessionStorage.getItem("userRole");
          storedUserId = sessionStorage.getItem("userId");
          storedUsername = sessionStorage.getItem("username");
        }

        // Check if user is authenticated
        const isAuthenticated = !!(storedToken && storedRole);

        // Check if user has required role
        let hasRequiredRole = true;
        if (requiredRole) {
          if (Array.isArray(requiredRole)) {
            hasRequiredRole = requiredRole.includes(storedRole || "");
          } else {
            hasRequiredRole = storedRole === requiredRole;
          }
        }

        // Check if user role is in allowed roles
        const hasAllowedRole = allowedRoles.includes(storedRole || "");

        const finalAuthState = isAuthenticated && hasAllowedRole && hasRequiredRole;

        setAuthState({
          token: storedToken,
          userRole: storedRole,
          userId: storedUserId,
          username: storedUsername,
          isLoading: false,
          isAuthenticated: finalAuthState,
        });

        // Redirect if not authenticated or doesn't have required role
        if (!finalAuthState) {
          handleRedirect(redirectTo);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setAuthState({
          token: null,
          userRole: null,
          userId: null,
          username: null,
          isLoading: false,
          isAuthenticated: false,
        });

        handleRedirect(redirectTo);
      }
    };

    checkAuth();
  }, [requiredRole, redirectTo, handleRedirect]); // Only include stable dependencies

  return authState;
}

// Specialized hooks for common use cases
export function useSuperAdminAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    userRole: null,
    userId: null,
    username: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      try {
        let storedToken = localStorage.getItem("token");
        let storedRole = localStorage.getItem("userRole");
        let storedUserId = localStorage.getItem("userId");
        let storedUsername = localStorage.getItem("username");

        if (!storedToken) {
          storedToken = sessionStorage.getItem("token");
          storedRole = sessionStorage.getItem("userRole");
          storedUserId = sessionStorage.getItem("userId");
          storedUsername = sessionStorage.getItem("username");
        }

        const isAuthenticated = !!(storedToken && storedRole === "SUPER_ADMIN");

        setAuthState({
          token: storedToken,
          userRole: storedRole,
          userId: storedUserId,
          username: storedUsername,
          isLoading: false,
          isAuthenticated,
        });

        if (!isAuthenticated) {
          setTimeout(() => router.push("/admin"), 100);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setAuthState({
          token: null,
          userRole: null,
          userId: null,
          username: null,
          isLoading: false,
          isAuthenticated: false,
        });
        setTimeout(() => router.push("/admin"), 100);
      }
    };

    checkAuth();
  }, [router]);

  return authState;
}

export function useAdminAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    userRole: null,
    userId: null,
    username: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      try {
        let storedToken = localStorage.getItem("token");
        let storedRole = localStorage.getItem("userRole");
        let storedUserId = localStorage.getItem("userId");
        let storedUsername = localStorage.getItem("username");

        if (!storedToken) {
          storedToken = sessionStorage.getItem("token");
          storedRole = sessionStorage.getItem("userRole");
          storedUserId = sessionStorage.getItem("userId");
          storedUsername = sessionStorage.getItem("username");
        }

        const isAuthenticated = !!(storedToken && (storedRole === "ADMIN" || storedRole === "SUPER_ADMIN"));

        setAuthState({
          token: storedToken,
          userRole: storedRole,
          userId: storedUserId,
          username: storedUsername,
          isLoading: false,
          isAuthenticated,
        });

        if (!isAuthenticated) {
          setTimeout(() => router.push("/login"), 100);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setAuthState({
          token: null,
          userRole: null,
          userId: null,
          username: null,
          isLoading: false,
          isAuthenticated: false,
        });
        setTimeout(() => router.push("/login"), 100);
      }
    };

    checkAuth();
  }, [router]);

  return authState;
}

export function useDriverAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    token: null,
    userRole: null,
    userId: null,
    username: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      try {
        let storedToken = localStorage.getItem("token");
        let storedRole = localStorage.getItem("userRole");
        let storedUserId = localStorage.getItem("userId");
        let storedUsername = localStorage.getItem("username");

        if (!storedToken) {
          storedToken = sessionStorage.getItem("token");
          storedRole = sessionStorage.getItem("userRole");
          storedUserId = sessionStorage.getItem("userId");
          storedUsername = sessionStorage.getItem("username");
        }

        const isAuthenticated = !!(storedToken && storedRole === "DRIVER");

        setAuthState({
          token: storedToken,
          userRole: storedRole,
          userId: storedUserId,
          username: storedUsername,
          isLoading: false,
          isAuthenticated,
        });

        if (!isAuthenticated) {
          setTimeout(() => router.push("/login"), 100);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setAuthState({
          token: null,
          userRole: null,
          userId: null,
          username: null,
          isLoading: false,
          isAuthenticated: false,
        });
        setTimeout(() => router.push("/login"), 100);
      }
    };

    checkAuth();
  }, [router]);

  return authState;
}

// Loading component for consistent loading states
export function AuthLoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

// Access denied component for consistent error states
export function AccessDenied({ 
  title = "Access Denied", 
  message = "You don't have permission to access this page" 
}: { 
  title?: string; 
  message?: string; 
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{title}</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
