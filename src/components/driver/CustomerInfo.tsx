'use client';

import React from 'react';

interface CustomerInfoProps {
  customer: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber?: string;
    groupCode?: string;
  };
  invoiceNumber?: string;
}

export default function CustomerInfo({ customer, invoiceNumber }: CustomerInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h2 className="text-lg font-semibold mb-2">Customer Information</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="font-medium">Name:</p>
          <p className="text-gray-700">{customer.name}</p>
        </div>
        <div>
          <p className="font-medium">Address:</p>
          <p className="text-gray-700">
            {customer.address}, {customer.city}, {customer.state} {customer.zipCode}
          </p>
        </div>
        {customer.phoneNumber && (
          <div>
            <p className="font-medium">Phone:</p>
            <p className="text-gray-700">{customer.phoneNumber}</p>
          </div>
        )}
        {customer.groupCode && (
          <div>
            <p className="font-medium">Group Code:</p>
            <p className="text-gray-700">{customer.groupCode}</p>
          </div>
        )}
        {invoiceNumber && (
          <div>
            <p className="font-medium">Invoice #:</p>
            <p className="text-gray-700">{invoiceNumber}</p>
          </div>
        )}
      </div>
    </div>
  );
}
