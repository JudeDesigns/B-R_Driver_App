"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import TodaysRoutesSidebar from "@/components/admin/TodaysRoutesSidebar";
import NavItem from "@/components/admin/NavItem";
import NavGroup from "@/components/admin/NavGroup";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Determine which nav group (if any) contains the current route.
  const getGroupForPathname = (path: string): string | null => {
    if (path.startsWith("/admin/routes")) return "routes-operations";
    if (path.startsWith("/admin/customers") || path.startsWith("/admin/products"))
      return "customers-products";
    if (
      path.startsWith("/admin/vehicles") ||
      path === "/admin/drivers/locations" ||
      path === "/admin/kpis"
    )
      return "fleet-drivers";
    if (
      path === "/admin/safety-checks" ||
      path === "/admin/document-management" ||
      path === "/admin/system-documents" ||
      path === "/admin/closeout-instructions"
    )
      return "compliance-documents";
    if (path === "/admin/user-management" || path === "/admin/file-management")
      return "administration";
    return null;
  };

  // Restore last-open group (localStorage), then let the active route override it.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("adminOpenNavGroup");
      if (stored) {
        setOpenGroup(stored);
      }
    } catch (error) {
      // localStorage may be unavailable; ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the route changes, auto-open the group that contains it (and close the rest).
  useEffect(() => {
    const matched = getGroupForPathname(pathname);
    if (matched) {
      setOpenGroup(matched);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroup((prev) => {
      const next = prev === id ? null : id;
      try {
        if (next) {
          localStorage.setItem("adminOpenNavGroup", next);
        } else {
          localStorage.removeItem("adminOpenNavGroup");
        }
      } catch (error) {
        // localStorage may be unavailable; ignore
      }
      return next;
    });
  };

  // Restore collapsed preference (desktop only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("adminSidebarCollapsed");
      if (stored === "true") {
        setSidebarCollapsed(true);
      }
    } catch (error) {
      // localStorage may be unavailable; ignore and keep default expanded state
    }
  }, []);

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

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("adminSidebarCollapsed", String(next));
      } catch (error) {
        // localStorage may be unavailable; ignore
      }
      return next;
    });
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
        {/* Desktop sidebar expand button (visible only when collapsed) */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex fixed top-4 left-4 z-40 text-gray-800 hover:text-gray-900 bg-white p-2 rounded-md shadow-md transition duration-200"
            aria-label="Expand sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        {/* Overlay for mobile when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0 fixed md:static inset-y-0 left-0 z-30 w-64 ${
            sidebarCollapsed ? "md:w-0 md:opacity-0 md:pointer-events-none md:overflow-hidden" : "md:w-64"
          } bg-gray-900 shadow-sidebar transform transition-all duration-200 ease-in-out flex flex-col h-screen overflow-hidden`}
        >
          {/* Desktop collapse toggle */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden md:flex items-center justify-center py-3 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors duration-200 flex-shrink-0"
            aria-label="Collapse sidebar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
          {/* Fixed Header Section */}
          <div className="flex-shrink-0">
            <div className="flex justify-between items-center p-4 md:hidden">
              <h2 className="text-lg font-medium text-white">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-white hover:text-gray-300"
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
            <div className="px-4 pb-2">
              <span className="text-sm text-gray-400">Admin Console</span>
            </div>
          </div>

          {/* Scrollable Navigation Section */}
          <nav className="flex-1 overflow-y-auto p-4 sidebar-scroll-hidden">
            <ul className="space-y-3">
              <NavItem
                href="/admin"
                label="Dashboard"
                color="blue"
                compact
                onNavigate={() => setSidebarOpen(false)}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                }
              />

              <li className="pt-2 mt-1 border-t border-gray-800" aria-hidden="true" />

              <NavGroup
                id="routes-operations"
                label="Routes & Operations"
                color="green"
                open={openGroup === "routes-operations"}
                onToggle={() => toggleGroup("routes-operations")}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                }
              >
                <NavItem
                  href="/admin/routes"
                  label="Routes"
                  color="green"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                  }
                />

                {/* Today's Routes Submenu */}
                {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
                  <TodaysRoutesSidebar />
                )}

                {/* Only show Upload Route menu item for ADMIN and SUPER_ADMIN users */}
                {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
                  <NavItem
                    href="/admin/routes/upload"
                    label="Upload Route"
                    color="green"
                    indent
                    onNavigate={() => setSidebarOpen(false)}
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    }
                  />
                )}

                {/* Only show Driver Route Maps menu item for ADMIN and SUPER_ADMIN users */}
                {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
                  <NavItem
                    href="/admin/routes/driver-maps"
                    label="Driver Route Maps"
                    color="green"
                    indent
                    onNavigate={() => setSidebarOpen(false)}
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    }
                  />
                )}
              </NavGroup>

              <li className="pt-2 mt-1 border-t border-gray-800" aria-hidden="true" />

              <NavGroup
                id="customers-products"
                label="Customers & Products"
                color="orange"
                open={openGroup === "customers-products"}
                onToggle={() => toggleGroup("customers-products")}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                }
              >
                <NavItem
                  href="/admin/customers"
                  label="Customers"
                  color="orange"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  }
                />
                <NavItem
                  href="/admin/customers/create"
                  label="Add New Customer"
                  color="orange"
                  indent
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  }
                />
                <NavItem
                  href="/admin/products"
                  label="Products"
                  color="orange"
                  matchPrefix
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  }
                />
              </NavGroup>

              {/* Vehicle Management */}
              <li className="pt-2 mt-1 border-t border-gray-800" aria-hidden="true" />

              <NavGroup
                id="fleet-drivers"
                label="Fleet & Drivers"
                color="cyan"
                open={openGroup === "fleet-drivers"}
                onToggle={() => toggleGroup("fleet-drivers")}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                  />
                }
              >
                <NavItem
                  href="/admin/vehicles"
                  label="Vehicle Management"
                  color="cyan"
                  matchPrefix
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                      />
                    </>
                  }
                />
                <NavItem
                  href="/admin/drivers/locations"
                  label="Driver Locations"
                  color="cyan"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <>
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
                    </>
                  }
                />
                <NavItem
                  href="/admin/kpis"
                  label="Driver Performance"
                  color="cyan"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  }
                />
              </NavGroup>

              <li className="pt-2 mt-1 border-t border-gray-800" aria-hidden="true" />

              <NavGroup
                id="compliance-documents"
                label="Compliance & Documents"
                color="indigo"
                open={openGroup === "compliance-documents"}
                onToggle={() => toggleGroup("compliance-documents")}
                icon={
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                }
              >
                <NavItem
                  href="/admin/safety-checks"
                  label="Safety Checks"
                  color="indigo"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  }
                />
                <NavItem
                  href="/admin/document-management"
                  label="Document Management"
                  color="indigo"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  }
                />
                <NavItem
                  href="/admin/system-documents"
                  label="System Documents"
                  color="indigo"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  }
                />
                <NavItem
                  href="/admin/closeout-instructions"
                  label="Check-in Instructions"
                  color="indigo"
                  onNavigate={() => setSidebarOpen(false)}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  }
                />
              </NavGroup>

              {/* Super Admin Only - Administration */}
              {userRole === "SUPER_ADMIN" && (
                <>
                  <li className="pt-2 mt-1 border-t border-gray-800" aria-hidden="true" />
                  <NavGroup
                    id="administration"
                    label="Administration"
                    color="purple"
                    open={openGroup === "administration"}
                    onToggle={() => toggleGroup("administration")}
                  icon={
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  }
                >
                  <NavItem
                    href="/admin/user-management"
                    label="User Management"
                    color="purple"
                    onNavigate={() => setSidebarOpen(false)}
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    }
                  />
                  <NavItem
                    href="/admin/file-management"
                    label="File Management"
                    color="purple"
                    onNavigate={() => setSidebarOpen(false)}
                    icon={
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V5a2 2 0 012-2h14a2 2 0 012 2v2"
                      />
                    }
                  />
                  </NavGroup>
                </>
              )}

            </ul>
          </nav>

          {/* Fixed Logout Section at Bottom */}
          <div className="flex-shrink-0 border-t border-gray-800 p-4 bg-gray-900">
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
