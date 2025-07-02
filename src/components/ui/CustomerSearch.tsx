"use client";

import React, { useState, useEffect, useRef } from "react";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  groupCode?: string;
}

interface CustomerSearchProps {
  value: string;
  onChange: (customerName: string, customer?: Customer) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  debug?: boolean; // Add debug mode
}

export default function CustomerSearch({
  value,
  onChange,
  placeholder = "Search for a customer...",
  required = false,
  className = "",
  debug = false,
}: CustomerSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value with internal searchTerm
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchCustomers(searchTerm);
      } else {
        setCustomers([]);
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchCustomers = async (query: string) => {
    setLoading(true);
    console.log("🔍 Searching for customers with query:", query);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("❌ No auth token found");
        setCustomers([]);
        setIsOpen(false);
        setLoading(false);
        return;
      }

      const url = `/api/admin/customers/search?q=${encodeURIComponent(query)}`;
      console.log("📡 Making request to:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("📊 Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Search results:", data);
        const customerResults = data.customers || [];
        setCustomers(customerResults);
        setIsOpen(true); // Always open dropdown to show results or "no results" message

        if (customerResults.length === 0) {
          console.log("📭 No customers found for query:", query);
        }
      } else {
        const errorData = await response.text();
        console.error("❌ Search failed:", response.status, errorData);
        setCustomers([]);
        setIsOpen(true); // Still open to show error/no results message
      }
    } catch (error) {
      console.error("❌ Error searching customers:", error);
      setCustomers([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setSelectedCustomer(null);
    // Only call onChange when user selects a customer, not on every keystroke
    // This prevents the parent form from being updated while user is typing
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSearchTerm(customer.name);
    setSelectedCustomer(customer);
    setIsOpen(false);
    onChange(customer.name, customer);
    inputRef.current?.blur();
  };

  // Handle manual typing (when user types a custom name)
  const handleInputBlur = () => {
    // If user typed something but didn't select a customer, treat it as a custom name
    if (searchTerm && !selectedCustomer) {
      onChange(searchTerm);
    }
  };

  const handleInputFocus = () => {
    if (searchTerm.length >= 2 && customers.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 ${className}`}
        />
        
        {/* Search icon */}
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {loading ? (
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Loading indicator */}
      {loading && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500 text-center">
            <svg className="animate-spin h-4 w-4 text-gray-400 inline mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Searching customers...
          </div>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !loading && customers.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {customers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => handleCustomerSelect(customer)}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                  {customer.email && (
                    <p className="text-xs text-gray-500">{customer.email}</p>
                  )}
                  {customer.address && (
                    <p className="text-xs text-gray-500 truncate">{customer.address}</p>
                  )}
                </div>
                {customer.groupCode && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {customer.groupCode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {!loading && customers.length === 0 && searchTerm.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-500 text-center">
            No customers found for "{searchTerm}"
            <br />
            <span className="text-xs">You can still type a custom name</span>
            <br />
            <span className="text-xs text-blue-500">Check browser console for debug info</span>
          </div>
        </div>
      )}

      {/* Debug info */}
      {debug && (
        <div className="mt-2 p-2 bg-gray-100 border border-gray-300 rounded text-xs">
          <div><strong>Debug Info:</strong></div>
          <div>Search term: "{searchTerm}" (length: {searchTerm.length})</div>
          <div>Is open: {isOpen ? 'Yes' : 'No'}</div>
          <div>Loading: {loading ? 'Yes' : 'No'}</div>
          <div>Customers found: {customers.length}</div>
          <div>Selected customer: {selectedCustomer ? selectedCustomer.name : 'None'}</div>
        </div>
      )}

      {/* Selected customer info */}
      {selectedCustomer && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center text-sm">
            <svg className="h-4 w-4 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-blue-700">
              Selected: <strong>{selectedCustomer.name}</strong>
              {selectedCustomer.groupCode && (
                <span className="ml-2 text-blue-600">({selectedCustomer.groupCode})</span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
