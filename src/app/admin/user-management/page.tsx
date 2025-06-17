"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EnhancedTable from "@/components/ui/EnhancedTable";
import Pagination from "@/components/ui/Pagination";
import TableActions from "@/components/ui/TableActions";
import { useSuperAdminAuth, AuthLoadingSpinner, AccessDenied } from "@/hooks/useAuth";

interface User {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "DRIVER" | "SUPER_ADMIN";
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  users: User[];
  totalCount: number;
  limit: number;
  offset: number;
}

export default function UserManagementPage() {
  // Use the Super Admin auth hook
  const { token, userRole, isLoading: authLoading, isAuthenticated } = useSuperAdminAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // Create/Edit user modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: "",
    fullName: "",
    password: "",
    role: "DRIVER" as "ADMIN" | "DRIVER" | "SUPER_ADMIN",
  });
  const [userFormError, setUserFormError] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  // Delete user modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, roleFilter, limit, offset]);

  const fetchUsers = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const queryParams = new URLSearchParams();
      if (roleFilter !== "ALL") queryParams.append("role", roleFilter);
      queryParams.append("limit", limit.toString());
      queryParams.append("offset", offset.toString());

      const response = await fetch(
        `/api/super-admin/users?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch users");
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setTotalCount(data.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      username: "",
      fullName: "",
      password: "",
      role: "DRIVER",
    });
    setUserFormError("");
    setShowUserModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      fullName: user.fullName,
      password: "", // Don't pre-fill password
      role: user.role,
    });
    setUserFormError("");
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!token) return;

    if (!userForm.username || !userForm.fullName || !userForm.role) {
      setUserFormError("Username, full name, and role are required");
      return;
    }

    if (!editingUser && !userForm.password) {
      setUserFormError("Password is required for new users");
      return;
    }

    setSavingUser(true);
    setUserFormError("");

    try {
      const url = editingUser
        ? `/api/super-admin/users/${editingUser.id}`
        : `/api/super-admin/users`;
      
      const method = editingUser ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save user");
      }

      // Success - refresh users list
      await fetchUsers();
      setShowUserModal(false);
      setEditingUser(null);
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!token || !userToDelete) return;

    setDeletingUser(true);

    try {
      const response = await fetch(`/api/super-admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete user");
      }

      // Success - refresh users list
      await fetchUsers();
      setShowDeleteModal(false);
      setUserToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeletingUser(false);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-purple-100 text-purple-800";
      case "ADMIN":
        return "bg-blue-100 text-blue-800";
      case "DRIVER":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Show loading spinner while checking authentication
  if (authLoading) {
    return <AuthLoadingSpinner message="Checking permissions..." />;
  }

  // Only show access denied if auth is complete and user is not authenticated
  if (!authLoading && !isAuthenticated) {
    return <AccessDenied title="Access Denied" message="Super Admin access required" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-medium text-gray-900">User Management</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleCreateUser}
              className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center"
            >
              Create User
            </button>
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
          <h2 className="text-lg font-medium text-mono-800">User Management ({totalCount})</h2>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-mono-700 mb-1">
                Search Users
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or username..."
                className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-mono-700 mb-1">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setOffset(0);
                }}
                className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">Admin</option>
                <option value="DRIVER">Driver</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setRoleFilter("ALL");
                  setSearchTerm("");
                  setOffset(0);
                }}
                className="w-full py-2 px-4 border border-mono-300 rounded-lg text-sm font-medium text-mono-700 hover:bg-mono-100 focus:outline-none focus:ring-2 focus:ring-primary-blue focus:ring-opacity-30 transition duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-primary-red bg-opacity-10 border border-primary-red border-opacity-30 text-primary-red px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Table container with fixed layout */}
          <div className="flex flex-col min-h-[500px]">
            {/* Content area (grows to fill available space) */}
            <div className="flex-grow">
              <EnhancedTable
                data={users.filter(user => {
                  const matchesSearch = searchTerm === "" ||
                    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.username.toLowerCase().includes(searchTerm.toLowerCase());
                  return matchesSearch;
                })}
                keyField="id"
                isLoading={loading}
                emptyState={
                  <div className="text-center py-8 text-gray-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-12 w-12 mx-auto text-gray-300 mb-4"
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
                    No users found. Try adjusting your filters or{" "}
                    <button
                      onClick={handleCreateUser}
                      className="text-primary-blue hover:text-blue-700 font-medium"
                    >
                      create a new user
                    </button>
                    .
                  </div>
                }
                columns={[
                  {
                    header: "User",
                    accessor: (user) => (
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.fullName}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{user.username}
                        </div>
                      </div>
                    ),
                  },
                  {
                    header: "Role",
                    accessor: (user) => (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeClass(
                          user.role
                        )}`}
                      >
                        {user.role.replace("_", " ")}
                      </span>
                    ),
                  },
                  {
                    header: "Created",
                    accessor: (user) => formatDate(user.createdAt),
                  },
                  {
                    header: "Actions",
                    accessor: (user) => (
                      <TableActions
                        actions={[
                          {
                            label: "Edit",
                            onClick: () => handleEditUser(user),
                            variant: "primary",
                          },
                          {
                            label: "Delete",
                            onClick: () => handleDeleteUser(user),
                            variant: "danger",
                          },
                        ]}
                      />
                    ),
                    align: "right",
                  },
                ]}
                striped
                stickyHeader
              />
            </div>

            {/* Pagination */}
            <Pagination
              totalItems={totalCount}
              itemsPerPage={limit}
              currentPage={Math.floor(offset / limit) + 1}
              onPageChange={(page) => setOffset((page - 1) * limit)}
              onItemsPerPageChange={(newLimit) => {
                setLimit(newLimit);
                setOffset(0);
              }}
              itemsPerPageOptions={[10, 25, 50, 100]}
              className="mt-4"
            />
          </div>
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingUser ? "Edit User" : "Create New User"}
                </h3>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password {editingUser ? "(leave blank to keep current)" : "*"}
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                    placeholder={editingUser ? "Enter new password" : "Enter password"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-200"
                  >
                    <option value="DRIVER">Driver</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>

                {userFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded">
                    {userFormError}
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowUserModal(false)}
                    disabled={savingUser}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUser}
                    disabled={savingUser}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center"
                  >
                    {savingUser ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      editingUser ? "Update User" : "Create User"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="mt-4 text-center">
                <h3 className="text-lg font-medium text-gray-900">
                  Delete User
                </h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete user "{userToDelete.fullName}" (@{userToDelete.username})?
                    This action cannot be undone and will permanently remove the user from the system.
                  </p>
                </div>

                <div className="flex justify-center space-x-3 mt-6">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deletingUser}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    disabled={deletingUser}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
                  >
                    {deletingUser && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
