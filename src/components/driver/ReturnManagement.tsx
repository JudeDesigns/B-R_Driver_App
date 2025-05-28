"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ReturnItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  reason: string;
}

interface ReturnManagementProps {
  stopId: string;
  routeId: string;
  customerId: string;
  token: string;
}

export default function ReturnManagement({
  stopId,
  routeId,
  customerId,
  token,
}: ReturnManagementProps) {
  const router = useRouter();

  // State for return data
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [notes, setNotes] = useState("");

  // State for product search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // State for new return item form
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");

  // State for UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search for products
  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/products/search?term=${encodeURIComponent(searchTerm)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to search products");
        }

        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Error searching products:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimeout = setTimeout(searchProducts, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchTerm, token]);

  // Add a return item
  const handleAddReturnItem = () => {
    if (!selectedProduct) {
      setError("Please select a product");
      return;
    }

    if (quantity <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    const newItem: ReturnItem = {
      id: `temp-${Date.now()}`, // Temporary ID until saved to database
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productCode: selectedProduct.sku,
      quantity,
      reason,
    };

    setReturnItems([...returnItems, newItem]);

    // Reset form
    setSelectedProduct(null);
    setQuantity(1);
    setReason("");
    setSearchTerm("");
    setSearchResults([]);
    setError("");
  };

  // Remove a return item
  const handleRemoveReturnItem = (id: string) => {
    setReturnItems(returnItems.filter((item) => item.id !== id));
  };

  // Submit the return
  const handleSubmitReturn = async () => {
    if (returnItems.length === 0) {
      setError("Please add at least one return item");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/driver/returns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stopId,
          routeId,
          customerId,
          notes,
          returnItems: returnItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            quantity: item.quantity,
            reason: item.reason,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit return");
      }

      setSuccess("Return submitted successfully");

      // Clear form after successful submission
      setReturnItems([]);
      setNotes("");

      // Redirect to stop details page
      setTimeout(() => {
        router.push(`/driver/stops/${stopId}`);
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Return Items List */}
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Return Items</h3>

        {returnItems.length === 0 ? (
          <p className="text-gray-500 italic">No return items added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>

                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returnItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.productName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.productCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.quantity}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {item.reason || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleRemoveReturnItem(item.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Return Item Form */}
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Add Return Item
        </h3>

        <div className="space-y-4">
          {/* Product Search */}
          <div>
            <label
              htmlFor="product-search"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Search Product
            </label>
            <input
              type="text"
              id="product-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or code (min 3 characters)"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {isSearching && (
              <div className="mt-2 text-sm text-gray-500">Searching...</div>
            )}

            {searchResults.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setSearchTerm(product.name);
                      setSearchResults([]);
                    }}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-500">
                      Code: {product.sku} | Unit:{" "}
                      {product.unit || "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedProduct && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <div className="font-medium">{selectedProduct.name}</div>
                <div className="text-sm">
                  Code: {selectedProduct.sku} | Unit:{" "}
                  {selectedProduct.unit || "N/A"}
                </div>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              min="1"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Reason */}
          <div>
            <label
              htmlFor="reason"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Reason for Return
            </label>
            <input
              type="text"
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this item being returned?"
              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={handleAddReturnItem}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition duration-200"
          >
            Add Item to Return
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmitReturn}
          disabled={isSubmitting || returnItems.length === 0}
          className="bg-black hover:bg-gray-800 text-white font-medium py-2 px-6 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting..." : "Submit Return"}
        </button>
      </div>
    </div>
  );
}
