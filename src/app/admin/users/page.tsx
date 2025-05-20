"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(
          `/api/admin/users?limit=${limit}&offset=${offset}&search=${searchTerm}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }

        const data = await response.json();
        setUsers(data.users);
        setTotalCount(data.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [router, limit, offset, searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setOffset(0); // Reset to first page when searching
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setOffset(0); // Reset to first page when changing limit
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-800";
      case "DRIVER":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-medium text-gray-900">Users</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/admin/users/new"
              className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center"
            >
              Add User
            </Link>
            <button
              onClick={() => router.push("/admin")}
              className="flex items-center justify-center text-primary-blue hover:text-blue-700 transition duration-200 font-medium py-2 px-4 border border-primary-blue rounded-lg hover:bg-blue-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">User List</h2>
        </div>

        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30 pl-10"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-mono-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-primary-red bg-opacity-10 border border-primary-red border-opacity-30 text-primary-red px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* User Table */}
          <div className="flex flex-col min-h-[500px]">
            <div className="flex-grow">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-mono-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto text-mono-300 mb-4"
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
                  <p>No users found. Try adjusting your search or{" "}
                  <Link
                    href="/admin/users/new"
                    className="text-primary-blue hover:text-blue-700 font-medium"
                  >
                    add a new user
                  </Link>
                  .</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-mono-200">
                    <thead className="bg-mono-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-mono-500 uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-mono-500 uppercase tracking-wider">
                          Full Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-mono-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-mono-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-mono-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-mono-200">
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className="hover:bg-mono-50 transition duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-mono-800">
                            {user.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-mono-600">
                            {user.fullName || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(
                                user.role
                              )}`}
                            >
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-mono-600">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-3">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="text-primary-blue hover:text-blue-700 transition duration-200"
                              >
                                View
                              </Link>
                              <Link
                                href={`/admin/users/${user.id}/edit`}
                                className="text-primary-green hover:text-green-700 transition duration-200"
                              >
                                Edit
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="mt-auto pt-6 border-t border-mono-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="text-sm text-mono-600">
                    Showing{" "}
                    <span className="font-medium text-mono-800">
                      {offset + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium text-mono-800">
                      {Math.min(offset + limit, totalCount)}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-mono-800">
                      {totalCount}
                    </span>{" "}
                    users
                  </div>
                  <div className="flex items-center">
                    <label htmlFor="itemsPerPage" className="sr-only">
                      Items per page
                    </label>
                    <select
                      id="itemsPerPage"
                      value={limit}
                      onChange={handleLimitChange}
                      className="rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                    >
                      <option value="10">10 per page</option>
                      <option value="25">25 per page</option>
                      <option value="50">50 per page</option>
                      <option value="100">100 per page</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-between sm:justify-end w-full sm:w-auto gap-2">
                  <button
                    onClick={() => handlePageChange(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    className="flex-1 sm:flex-none px-4 py-2 border border-mono-300 rounded-lg text-sm font-medium text-mono-700 hover:bg-mono-100 focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(offset + limit)}
                    disabled={offset + limit >= totalCount}
                    className="flex-1 sm:flex-none px-4 py-2 border border-mono-300 rounded-lg text-sm font-medium text-mono-700 hover:bg-mono-100 focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
