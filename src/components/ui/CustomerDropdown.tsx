"use client";

import React, { useState, useEffect } from "react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  groupCode?: string;
}

interface CustomerDropdownProps {
  value: string;
  onChange: (customerName: string, customer?: Customer) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function CustomerDropdown({
  value,
  onChange,
  placeholder = "Select a customer...",
  required = false,
  className = "",
}: CustomerDropdownProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");

  // Load all customers when component mounts
  useEffect(() => {
    loadCustomers();
  }, []);

  // Sync with external value
  useEffect(() => {
    if (value && !selectedCustomer) {
      // Check if the value matches any customer
      const matchingCustomer = customers.find(c => c.name === value);
      if (matchingCustomer) {
        setSelectedCustomer(matchingCustomer);
        setShowCustomInput(false);
      } else {
        // It's a custom name
        setCustomName(value);
        setShowCustomInput(true);
      }
    }
  }, [value, customers, selectedCustomer]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No auth token found");
        return;
      }

      const response = await fetch("/api/admin/customers/all", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      } else {
        console.error("Failed to load customers:", response.status);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    
    if (customerId === "custom") {
      // User wants to enter a custom name
      setSelectedCustomer(null);
      setShowCustomInput(true);
      setCustomName("");
      onChange("");
    } else if (customerId === "") {
      // User selected placeholder
      setSelectedCustomer(null);
      setShowCustomInput(false);
      setCustomName("");
      onChange("");
    } else {
      // User selected an existing customer
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setSelectedCustomer(customer);
        setShowCustomInput(false);
        setCustomName("");
        onChange(customer.name, customer);
      }
    }
  };

  const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCustomName(name);
    onChange(name);
  };

  return (
    <div className="space-y-2">
      {/* Customer Dropdown */}
      <div className="relative">
        <select
          value={selectedCustomer?.id || (showCustomInput ? "custom" : "")}
          onChange={handleCustomerSelect}
          required={required && !showCustomInput}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          disabled={loading}
        >
          <option value="">{loading ? "Loading customers..." : placeholder}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
              {customer.groupCode && ` (${customer.groupCode})`}
            </option>
          ))}
          <option value="custom">+ Enter custom name</option>
        </select>

        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      {/* Custom Name Input */}
      {showCustomInput && (
        <div>
          <input
            type="text"
            value={customName}
            onChange={handleCustomNameChange}
            placeholder="Enter customer name..."
            required={required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Entering a new customer name
          </p>
        </div>
      )}

      {/* Selected Customer Info */}
      {selectedCustomer && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center text-sm">
            <svg className="h-4 w-4 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-blue-700">
              <strong>{selectedCustomer.name}</strong>
              {selectedCustomer.groupCode && (
                <span className="ml-2 text-blue-600">({selectedCustomer.groupCode})</span>
              )}
            </span>
          </div>
          {selectedCustomer.email && (
            <p className="text-xs text-blue-600 ml-6">{selectedCustomer.email}</p>
          )}
          {selectedCustomer.address && (
            <p className="text-xs text-blue-600 ml-6">{selectedCustomer.address}</p>
          )}
        </div>
      )}

      {/* Error State */}
      {!loading && customers.length === 0 && (
        <div className="text-sm text-gray-500">
          No customers found. You can still enter a custom name above.
        </div>
      )}
    </div>
  );
}
