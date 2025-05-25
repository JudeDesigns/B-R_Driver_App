import React, { useState } from "react";

interface ProductBatchActionsProps {
  selectedProducts: string[];
  onBatchDelete: () => void;
  onBatchExport: () => void;
  onSelectionClear: () => void;
}

export default function ProductBatchActions({
  selectedProducts,
  onBatchDelete,
  onBatchExport,
  onSelectionClear,
}: ProductBatchActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (selectedProducts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-700">
              {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={onSelectionClear}
              className="ml-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Clear selection
            </button>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onBatchExport}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition duration-200 text-sm font-medium"
            >
              Export Selected
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition duration-200 text-sm font-medium"
            >
              Delete Selected
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Confirm Deletion
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to delete {selectedProducts.length} selected product{selectedProducts.length !== 1 ? "s" : ""}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded transition duration-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onBatchDelete();
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition duration-200 text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
