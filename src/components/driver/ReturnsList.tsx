'use client';

import React from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface Return {
  id: string;
  orderItemIdentifier: string;
  productDescription: string;
  quantity: number;
  reasonCode: string;
  warehouseLocation: string;
  vendorCreditNum: string;
  createdAt: string;
}

interface ReturnsListProps {
  returns: Return[];
  isLoading: boolean;
  error: string | null;
}

export default function ReturnsList({ returns, isLoading, error }: ReturnsListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  if (returns.length === 0) {
    return <p className="text-gray-500 italic">No returns recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Item
            </th>
            <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Qty
            </th>
            <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Reason
            </th>
            <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {returns.map((returnItem) => (
            <tr key={returnItem.id}>
              <td className="py-2 px-4 text-sm text-gray-900">
                {returnItem.orderItemIdentifier}
              </td>
              <td className="py-2 px-4 text-sm text-gray-900">
                {returnItem.productDescription}
              </td>
              <td className="py-2 px-4 text-sm text-gray-900">
                {returnItem.quantity}
              </td>
              <td className="py-2 px-4 text-sm text-gray-900">
                {returnItem.reasonCode}
              </td>
              <td className="py-2 px-4 text-sm text-gray-900">
                {returnItem.warehouseLocation || "N/A"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
