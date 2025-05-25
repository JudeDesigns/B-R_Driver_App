"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const router = useRouter();
  const productId = params.id;

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        const response = await fetch(`/api/admin/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch product details");
        }

        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        console.error("Error fetching product details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [router, productId]);

  const handleDelete = async () => {
    setDeleting(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete product");
      }

      router.push("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error deleting product:", err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
        Product not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-black">{product.name}</h1>
        <div className="flex space-x-3">
          <Link
            href="/admin/products"
            className="text-primary-blue hover:text-blue-700 transition duration-200 font-medium"
          >
            &larr; Back to Products
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-mono-800">Product Details</h2>
          <div className="flex space-x-3">
            <Link
              href={`/admin/products/${productId}/edit`}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition duration-200"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition duration-200"
            >
              Delete
            </button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                SKU
              </h3>
              <p className="text-gray-900">{product.sku}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Unit
              </h3>
              <p className="text-gray-900">{product.unit || "N/A"}</p>
            </div>
            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-gray-900">
                {product.description || "No description provided"}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Created At
              </h3>
              <p className="text-gray-900">{formatDate(product.createdAt)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                Last Updated
              </h3>
              <p className="text-gray-900">{formatDate(product.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the product "{product.name}"? This
              action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition duration-200"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition duration-200 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
