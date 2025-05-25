"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TableActions from "@/components/ui/TableActions";
import Table from "@/components/ui/Table";
import SearchInput from "@/components/ui/SearchInput";
import Pagination from "@/components/ui/Pagination";
import ProductBatchActions from "@/components/admin/ProductBatchActions";

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const router = useRouter();

  const fetchProducts = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());
      if (search) {
        params.append("search", search);
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch products");
      }

      const data = await response.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [router, limit, offset, search]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setOffset(0); // Reset to first page when searching
  };

  const handlePageChange = (page: number) => {
    setOffset((page - 1) * limit);
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedProducts(products.map((product) => product.id));
    } else {
      setSelectedProducts([]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedProducts.length === 0) return;

    setBatchDeleting(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/products/batch", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productIds: selectedProducts }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete products");
      }

      // Refresh products list
      fetchProducts();
      setSelectedProducts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting products:", err);
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleBatchExport = () => {
    if (selectedProducts.length === 0) return;

    // Filter products to only include selected ones
    const selectedProductsData = products.filter((product) =>
      selectedProducts.includes(product.id)
    );

    // Create CSV content
    const headers = ["SKU", "Name", "Unit", "Description"];
    const csvContent = [
      headers.join(","),
      ...selectedProductsData.map((product) =>
        [
          product.sku,
          `"${product.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
          product.unit || "",
          `"${(product.description || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `products_export_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-black">Products</h1>
        <div className="flex space-x-3">
          <Link
            href="/admin/products/upload"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition duration-200"
          >
            Upload Products
          </Link>
          <Link
            href="/admin/products/new"
            className="bg-black hover:bg-gray-800 text-white font-medium py-2 px-4 rounded transition duration-200"
          >
            Add New Product
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200">
          <h2 className="text-lg font-medium text-mono-800">Product List</h2>
        </div>
        <div className="p-6">
          <div className="mb-4">
            <SearchInput
              placeholder="Search products..."
              value={search}
              onChange={handleSearch}
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {search
                ? "No products found matching your search criteria."
                : "No products found. Add your first product!"}
            </div>
          ) : (
            <Table
              data={products}
              columns={[
                {
                  header: (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedProducts.length === products.length &&
                          products.length > 0
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  ),
                  accessor: (product) => (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                  ),
                  width: "40px",
                },
                {
                  header: "SKU",
                  accessor: "sku",
                },
                {
                  header: "Name",
                  accessor: "name",
                },
                {
                  header: "Unit",
                  accessor: (product) => product.unit || "N/A",
                },
                {
                  header: "Description",
                  accessor: (product) =>
                    product.description
                      ? product.description.length > 50
                        ? `${product.description.substring(0, 50)}...`
                        : product.description
                      : "N/A",
                },
                {
                  header: "Actions",
                  accessor: (product) => (
                    <TableActions
                      actions={[
                        {
                          label: "View",
                          href: `/admin/products/${product.id}`,
                          variant: "primary",
                        },
                        {
                          label: "Edit",
                          href: `/admin/products/${product.id}/edit`,
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

          {total > limit && (
            <div className="mt-4">
              <Pagination
                totalItems={total}
                itemsPerPage={limit}
                currentPage={Math.floor(offset / limit) + 1}
                onPageChange={handlePageChange}
                onItemsPerPageChange={(newLimit) => {
                  setLimit(newLimit);
                  setOffset(0);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Batch Actions */}
      <ProductBatchActions
        selectedProducts={selectedProducts}
        onBatchDelete={handleBatchDelete}
        onBatchExport={handleBatchExport}
        onSelectionClear={() => setSelectedProducts([])}
      />
    </div>
  );
}
