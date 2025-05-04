"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in and has admin role
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || (role !== "ADMIN" && role !== "SUPER_ADMIN")) {
      router.push("/login");
      return;
    }

    // Decode token to get username
    try {
      // For Phase 1, our token is just a base64 encoded JSON string
      const payload = JSON.parse(atob(token));
      setUsername(payload.username);
    } catch (error) {
      console.error("Error decoding token:", error);
      // Use a fallback username if token parsing fails
      setUsername("Admin User");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold uppercase tracking-tight">
              B&R FOOD SERVICES
            </h1>
            <span className="ml-4 text-sm text-gray-500">Admin Console</span>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-sm">Welcome, {username}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-black transition duration-200"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar and Main Content */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-200 bg-white">
          <nav className="p-6">
            <ul className="space-y-6">
              <li>
                <Link
                  href="/admin"
                  className="block text-gray-800 hover:text-black transition duration-200"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/routes"
                  className="block text-gray-800 hover:text-black transition duration-200"
                >
                  Route Management
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/customers"
                  className="block text-gray-800 hover:text-black transition duration-200"
                >
                  Customer Management
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/users"
                  className="block text-gray-800 hover:text-black transition duration-200"
                >
                  User Management
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
