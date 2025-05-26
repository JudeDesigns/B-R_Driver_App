"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveAs } from "file-saver";
import EnhancedTable, { Column } from "@/components/ui/EnhancedTable";
import TableActions, { Action } from "@/components/ui/TableActions";
import Pagination from "@/components/ui/Pagination";
import StatusBadge from "@/components/ui/StatusBadge";

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
  groupCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionSuccess, setBulkActionSuccess] = useState("");
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    groupCode: "",
  });
  const router = useRouter();

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(
          `/api/admin/customers?limit=${limit}&offset=${offset}&search=${searchTerm}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }

        const data = await response.json();
        setCustomers(data.customers);
        setTotalCount(data.totalCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching customers:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [router, limit, offset, searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setOffset(0); // Reset to first page when searching
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setOffset(0); // Reset to first page when changing limit
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset);
    setSelectedCustomers([]);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustomers(customers.map((customer) => customer.id));
    } else {
      setSelectedCustomers([]);
    }
  };

  const handleSelectCustomer = (
    e: React.ChangeEvent<HTMLInputElement>,
    customerId: string
  ) => {
    if (e.target.checked) {
      setSelectedCustomers([...selectedCustomers, customerId]);
    } else {
      setSelectedCustomers(selectedCustomers.filter((id) => id !== customerId));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedCustomers.length) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedCustomers.length} customers?`
      )
    ) {
      return;
    }

    setBulkActionLoading(true);
    setBulkActionSuccess("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/customers/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "delete",
          customerIds: selectedCustomers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete customers");
      }

      const data = await response.json();
      setBulkActionSuccess(data.message);
      setSelectedCustomers([]);

      // Refresh the customer list
      const fetchResponse = await fetch(
        `/api/admin/customers?limit=${limit}&offset=${offset}&search=${searchTerm}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!fetchResponse.ok) {
        throw new Error("Failed to refresh customers");
      }

      const fetchData = await fetchResponse.json();
      setCustomers(fetchData.customers);
      setTotalCount(fetchData.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error performing bulk delete:", err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkExport = async () => {
    if (!selectedCustomers.length) return;

    setBulkActionLoading(true);
    setBulkActionSuccess("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/customers/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "export",
          customerIds: selectedCustomers,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to export customers");
      }

      const data = await response.json();

      // Create CSV content
      const csvContent = [
        // CSV header
        [
          "ID",
          "Name",
          "Address",
          "Contact Info",
          "Preferences",
          "Group Code",
          "Created At",
        ].join(","),
        // CSV rows
        ...data.customers.map((customer: Customer) =>
          [
            customer.id,
            `"${customer.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
            `"${customer.address.replace(/"/g, '""')}"`,
            `"${
              customer.contactInfo
                ? customer.contactInfo.replace(/"/g, '""')
                : ""
            }"`,
            `"${
              customer.preferences
                ? customer.preferences.replace(/"/g, '""')
                : ""
            }"`,
            `"${
              customer.groupCode ? customer.groupCode.replace(/"/g, '""') : ""
            }"`,
            new Date(customer.createdAt).toLocaleDateString(),
          ].join(",")
        ),
      ].join("\n");

      // Create and download the CSV file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      saveAs(
        blob,
        `customers_export_${new Date().toISOString().slice(0, 10)}.csv`
      );

      setBulkActionSuccess(
        `Successfully exported ${data.customers.length} customers`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error performing bulk export:", err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleShowBulkUpdateModal = () => {
    if (!selectedCustomers.length) return;
    setShowBulkUpdateModal(true);
  };

  const handleBulkUpdate = async () => {
    if (!selectedCustomers.length) return;

    setBulkActionLoading(true);
    setBulkActionSuccess("");
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Filter out empty values
      const updateData = Object.fromEntries(
        Object.entries(bulkUpdateData).filter(([_, value]) => value !== "")
      );

      if (Object.keys(updateData).length === 0) {
        throw new Error("Please provide at least one field to update");
      }

      const response = await fetch("/api/admin/customers/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "update",
          customerIds: selectedCustomers,
          updateData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update customers");
      }

      const data = await response.json();
      setBulkActionSuccess(data.message);
      setShowBulkUpdateModal(false);
      setBulkUpdateData({ groupCode: "" });

      // Refresh the customer list
      const fetchResponse = await fetch(
        `/api/admin/customers?limit=${limit}&offset=${offset}&search=${searchTerm}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!fetchResponse.ok) {
        throw new Error("Failed to refresh customers");
      }

      const fetchData = await fetchResponse.json();
      setCustomers(fetchData.customers);
      setTotalCount(fetchData.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error performing bulk update:", err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-medium text-gray-900">Customers</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/admin/customers/create"
              className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 text-center"
            >
              Add Customer
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

        {/* Bulk Action Success Message */}
        {bulkActionSuccess && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {bulkActionSuccess}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">Customer List</h2>
        </div>

        <div className="p-6">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search customers..."
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

          {/* Customer Table */}
          <div className="flex flex-col min-h-[500px]">
            <div className="flex-grow">
              {error ? (
                <div className="text-center py-8 text-red-500">{error}</div>
              ) : (
                <EnhancedTable
                  data={customers}
                  keyField="id"
                  isLoading={loading}
                  selectedRows={selectedCustomers}
                  onSelectRow={(id, checked) => {
                    if (checked) {
                      setSelectedCustomers([
                        ...selectedCustomers,
                        id as string,
                      ]);
                    } else {
                      setSelectedCustomers(
                        selectedCustomers.filter(
                          (customerId) => customerId !== id
                        )
                      );
                    }
                  }}
                  onSelectAll={(checked) => {
                    if (checked) {
                      setSelectedCustomers(
                        customers.map((customer) => customer.id)
                      );
                    } else {
                      setSelectedCustomers([]);
                    }
                  }}
                  bulkActions={[
                    {
                      label: "Update",
                      onClick: handleShowBulkUpdateModal,
                      variant: "primary",
                      disabled: bulkActionLoading,
                    },
                    {
                      label: "Export",
                      onClick: handleBulkExport,
                      variant: "success",
                      disabled: bulkActionLoading,
                    },
                    {
                      label: "Delete",
                      onClick: handleBulkDelete,
                      variant: "danger",
                      disabled: bulkActionLoading,
                    },
                  ]}
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
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      No customers found. Try adjusting your search or{" "}
                      <Link
                        href="/admin/customers/create"
                        className="text-primary-blue hover:text-blue-700 font-medium"
                      >
                        add a new customer
                      </Link>
                      .
                    </div>
                  }
                  columns={[
                    {
                      header: "Name",
                      accessor: "name",
                    },
                    {
                      header: "Group Code",
                      accessor: (customer) => customer.groupCode || "N/A",
                    },
                    {
                      header: "Address",
                      accessor: "address",
                    },
                    {
                      header: "Contact",
                      accessor: (customer) => customer.contactInfo || "N/A",
                    },
                    {
                      header: "Actions",
                      accessor: (customer) => (
                        <TableActions
                          actions={[
                            {
                              label: "View",
                              href: `/admin/customers/${customer.id}`,
                              variant: "primary",
                            },
                            {
                              label: "Edit",
                              href: `/admin/customers/${customer.id}/edit`,
                              variant: "success",
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
              )}
            </div>

            {/* Pagination */}
            <Pagination
              totalItems={totalCount}
              itemsPerPage={limit}
              currentPage={Math.floor(offset / limit) + 1}
              onPageChange={(page) => handlePageChange((page - 1) * limit)}
              onItemsPerPageChange={handleLimitChange}
              itemsPerPageOptions={[10, 25, 50, 100]}
              className="mt-4"
            />
          </div>
        </div>
      </div>
      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Update {selectedCustomers.length} Customers
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="groupCode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Group Code
                </label>
                <input
                  type="text"
                  id="groupCode"
                  value={bulkUpdateData.groupCode}
                  onChange={(e) =>
                    setBulkUpdateData({
                      ...bulkUpdateData,
                      groupCode: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border-mono-300 shadow-sm focus:border-primary-blue focus:ring focus:ring-primary-blue focus:ring-opacity-30"
                  placeholder="Leave empty to keep current values"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-primary-red bg-opacity-10 border border-primary-red border-opacity-30 text-primary-red px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkUpdateModal(false)}
                className="px-4 py-2 border border-mono-300 rounded-lg text-sm font-medium text-mono-700 hover:bg-mono-100 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={bulkActionLoading}
                className="px-4 py-2 bg-primary-blue text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkActionLoading ? "Updating..." : "Update Customers"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
