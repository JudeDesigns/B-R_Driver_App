'use client';

import React, { useState } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface ReturnFormProps {
  onSubmit: (returnData: ReturnData) => Promise<void>;
  isSubmitting: boolean;
}

export interface ReturnData {
  orderItemIdentifier: string;
  productDescription: string;
  quantity: number;
  reasonCode: string;
  warehouseLocation: string;
  vendorCreditNum: string;
}

export default function ReturnForm({ onSubmit, isSubmitting }: ReturnFormProps) {
  const [returnData, setReturnData] = useState<ReturnData>({
    orderItemIdentifier: '',
    productDescription: '',
    quantity: 1,
    reasonCode: '',
    warehouseLocation: '',
    vendorCreditNum: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setReturnData((prev) => ({
      ...prev,
      [name]: name === 'quantity' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(returnData);
    
    // Reset form after submission
    setReturnData({
      orderItemIdentifier: '',
      productDescription: '',
      quantity: 1,
      reasonCode: '',
      warehouseLocation: '',
      vendorCreditNum: '',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="orderItemIdentifier" className="block text-sm font-medium text-gray-700">
            Item Identifier *
          </label>
          <input
            type="text"
            id="orderItemIdentifier"
            name="orderItemIdentifier"
            value={returnData.orderItemIdentifier}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="productDescription" className="block text-sm font-medium text-gray-700">
            Product Description *
          </label>
          <input
            type="text"
            id="productDescription"
            name="productDescription"
            value={returnData.productDescription}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
            Quantity *
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            min="1"
            value={returnData.quantity}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="reasonCode" className="block text-sm font-medium text-gray-700">
            Reason Code *
          </label>
          <select
            id="reasonCode"
            name="reasonCode"
            value={returnData.reasonCode}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select a reason</option>
            <option value="DAMAGED">Damaged</option>
            <option value="EXPIRED">Expired</option>
            <option value="WRONG_ITEM">Wrong Item</option>
            <option value="CUSTOMER_REFUSED">Customer Refused</option>
            <option value="QUALITY_ISSUE">Quality Issue</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="warehouseLocation" className="block text-sm font-medium text-gray-700">
            Warehouse Location
          </label>
          <input
            type="text"
            id="warehouseLocation"
            name="warehouseLocation"
            value={returnData.warehouseLocation}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="vendorCreditNum" className="block text-sm font-medium text-gray-700">
            Vendor Credit #
          </label>
          <input
            type="text"
            id="vendorCreditNum"
            name="vendorCreditNum"
            value={returnData.vendorCreditNum}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="py-2 px-4 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition duration-200"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <LoadingSpinner size="sm" className="mr-2" />
              Adding...
            </span>
          ) : (
            "Add Return"
          )}
        </button>
      </div>
    </form>
  );
}
