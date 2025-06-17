"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import TodaysRoutesSidebar from "@/components/admin/TodaysRoutesSidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check if user is logged in and has admin role
    try {
      // Check both localStorage and sessionStorage, with preference for localStorage for admins
      let token, userRole, storedUsername;

      // First check localStorage (preferred for admins)
      token = localStorage.getItem("token");
      userRole = localStorage.getItem("userRole");
      storedUsername = localStorage.getItem("username");

      // If not found in localStorage, check sessionStorage
      if (!token) {
        token = sessionStorage.getItem("token");
        userRole = sessionStorage.getItem("userRole");
        storedUsername = sessionStorage.getItem("username");
      }

      if (!token || (userRole !== "ADMIN" && userRole !== "SUPER_ADMIN")) {
        router.push("/login");
        return;
      }

      // Store the actual user role in state (SUPER_ADMIN, ADMIN, DRIVER)
      setUserRole(userRole);

      // Use the stored username directly instead of trying to decode the token
      if (storedUsername) {
        setUsername(storedUsername);
      } else {
        setUsername("Admin User");
      }
    } catch (error) {
      console.error("Error in auth check:", error);
      router.push("/login");
    }
  }, [router]);

  // Close sidebar when route changes (for mobile)
  useEffect(() => {
    const handleRouteChange = () => {
      setSidebarOpen(false);
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  const handleLogout = () => {
    // Clear all authentication data from both localStorage and sessionStorage
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("userId");

    // Force a page reload to clear any cached state
    window.location.href = "/login";
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      {/* Sidebar and Main Content */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Mobile sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 md:hidden text-gray-800 hover:text-gray-900 bg-white p-2 rounded-md shadow-md transition duration-200"
          aria-label="Toggle sidebar"
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
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        {/* Overlay for mobile when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 fixed md:static inset-y-0 left-0 z-30 w-64 bg-gray-900 shadow-sidebar transform transition-transform duration-200 ease-in-out md:transition-none flex flex-col h-screen overflow-hidden`}
        >
          <div className="flex justify-between items-center p-4 md:hidden">
            <h2 className="text-lg font-medium text-white">Menu</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-white hover:text-mono-200"
              aria-label="Close sidebar"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="p-4 flex items-center">
            <h1 className="text-xl font-bold text-white uppercase tracking-tight">
              B&R FOOD SERVICES
            </h1>
          </div>
          <div className="px-4">
            <span className="text-sm text-mono-400">Admin Console</span>
          </div>
          <nav className="p-4 flex-grow">
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admin"
                  className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin"
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {pathname === "/admin" && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-blue-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-blue-500 transition-all duration-300 ${
                      pathname === "/admin"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 text-primary-blue transition-transform duration-300 ${
                      pathname === "/admin"
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
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
                  <span
                    className={`font-medium transition-all duration-300 ${
                      pathname === "/admin"
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Dashboard
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/routes"
                  className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin/routes"
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {pathname === "/admin/routes" && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-green-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-green-500 transition-all duration-300 ${
                      pathname === "/admin/routes"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 text-primary-green transition-transform duration-300 ${
                      pathname === "/admin/routes"
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
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
                  <span
                    className={`font-medium transition-all duration-300 ${
                      pathname === "/admin/routes"
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Routes
                  </span>
                </Link>
              </li>

              {/* Today's Routes Submenu */}
              {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
                <TodaysRoutesSidebar />
              )}

              {/* Only show Upload Route menu item for ADMIN and SUPER_ADMIN users */}
              {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
                <li>
                  <Link
                    href="/admin/routes/upload"
                    className={`flex items-center py-2.5 px-4 pl-12 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                      pathname === "/admin/routes/upload"
                        ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                        : "hover:bg-gray-800"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {pathname === "/admin/routes/upload" && (
                      <span className="absolute left-0 top-0 h-full w-1 bg-green-500"></span>
                    )}
                    <span
                      className={`absolute inset-0 w-1 bg-green-500 transition-all duration-300 ${
                        pathname === "/admin/routes/upload"
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    ></span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 mr-3 text-primary-green transition-transform duration-300 ${
                        pathname === "/admin/routes/upload"
                          ? "scale-110"
                          : "group-hover:scale-110"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <span
                      className={`font-medium text-sm transition-all duration-300 ${
                        pathname === "/admin/routes/upload"
                          ? "text-white"
                          : "group-hover:translate-x-1"
                      }`}
                    >
                      Upload Route
                    </span>
                  </Link>
                </li>
              )}
              <li>
                <Link
                  href="/admin/customers"
                  className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin/customers"
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {pathname === "/admin/customers" && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-orange-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-orange-500 transition-all duration-300 ${
                      pathname === "/admin/customers"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 text-primary-orange transition-transform duration-300 ${
                      pathname === "/admin/customers"
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span
                    className={`font-medium transition-all duration-300 ${
                      pathname === "/admin/customers"
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Customers
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/customers/create"
                  className={`flex items-center py-2.5 px-4 pl-12 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin/customers/create"
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {pathname === "/admin/customers/create" && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-orange-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-orange-500 transition-all duration-300 ${
                      pathname === "/admin/customers/create"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 mr-3 text-primary-orange transition-transform duration-300 ${
                      pathname === "/admin/customers/create"
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                  <span
                    className={`font-medium text-sm transition-all duration-300 ${
                      pathname === "/admin/customers/create"
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Add New Customer
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/products"
                  className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin/products" ||
                    pathname.startsWith("/admin/products/")
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {(pathname === "/admin/products" ||
                    pathname.startsWith("/admin/products/")) && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-yellow-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-yellow-500 transition-all duration-300 ${
                      pathname === "/admin/products" ||
                      pathname.startsWith("/admin/products/")
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 text-yellow-500 transition-transform duration-300 ${
                      pathname === "/admin/products" ||
                      pathname.startsWith("/admin/products/")
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  <span
                    className={`font-medium transition-all duration-300 ${
                      pathname === "/admin/products" ||
                      pathname.startsWith("/admin/products/")
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Products
                  </span>
                </Link>
              </li>

              {/* Super Admin Only - User Management */}
              {userRole === "SUPER_ADMIN" && (
                <li>
                  <Link
                    href="/admin/user-management"
                    className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                      pathname === "/admin/user-management"
                        ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                        : "hover:bg-gray-800"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    {pathname === "/admin/user-management" && (
                      <span className="absolute left-0 top-0 h-full w-1 bg-purple-500"></span>
                    )}
                    <span
                      className={`absolute inset-0 w-1 bg-purple-500 transition-all duration-300 ${
                        pathname === "/admin/user-management"
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                    ></span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-5 w-5 mr-3 text-primary-purple transition-transform duration-300 ${
                        pathname === "/admin/user-management"
                          ? "scale-110"
                          : "group-hover:scale-110"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <span
                      className={`font-medium transition-all duration-300 ${
                        pathname === "/admin/user-management"
                          ? "text-white"
                          : "group-hover:translate-x-1"
                      }`}
                    >
                      User Management
                    </span>
                  </Link>
                </li>
              )}

              <li>
                <Link
                  href="/admin/safety-checks"
                  className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin/safety-checks"
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {pathname === "/admin/safety-checks" && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-cyan-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-cyan-500 transition-all duration-300 ${
                      pathname === "/admin/safety-checks"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 text-primary-cyan transition-transform duration-300 ${
                      pathname === "/admin/safety-checks"
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <span
                    className={`font-medium transition-all duration-300 ${
                      pathname === "/admin/safety-checks"
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Safety Checks
                  </span>
                </Link>
              </li>

              <li>
                <Link
                  href="/admin/documents"
                  className={`flex items-center py-2.5 px-4 text-white rounded-lg transition-all duration-300 relative overflow-hidden group ${
                    pathname === "/admin/documents"
                      ? "bg-gradient-to-r from-gray-800 to-gray-700 shadow-md"
                      : "hover:bg-gray-800"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {pathname === "/admin/documents" && (
                    <span className="absolute left-0 top-0 h-full w-1 bg-indigo-500"></span>
                  )}
                  <span
                    className={`absolute inset-0 w-1 bg-indigo-500 transition-all duration-300 ${
                      pathname === "/admin/documents"
                        ? "opacity-100"
                        : "opacity-0 group-hover:opacity-100"
                    }`}
                  ></span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-3 text-indigo-500 transition-transform duration-300 ${
                      pathname === "/admin/documents"
                        ? "scale-110"
                        : "group-hover:scale-110"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span
                    className={`font-medium transition-all duration-300 ${
                      pathname === "/admin/documents"
                        ? "text-white"
                        : "group-hover:translate-x-1"
                    }`}
                  >
                    Documents
                  </span>
                </Link>
              </li>
            </ul>
          </nav>

          {/* Logout button at bottom of sidebar */}
          <div className="mt-auto border-t border-gray-800 p-4">
            <div className="flex flex-col space-y-3">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium mr-3">
                  {username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-sm text-white font-medium">
                    Welcome,
                  </span>
                  <p className="text-sm text-gray-300">{username}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-full py-2 px-3 text-sm text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-all duration-300 group"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 group-hover:text-red-400 transition-colors duration-300"
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
                <span className="group-hover:text-red-400 transition-colors duration-300">
                  Sign out
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-auto bg-mono-50 h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
