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

interface CustomerDropdownProps {
  value: string;
  onChange: (customerName: string, customer?: Customer) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

// Fallback customer list (only used if API fails)
const FALLBACK_CUSTOMERS: Customer[] = [
  { id: "fallback-1", name: "Enter custom name...", address: "", phone: "" },
];

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

  // Search combobox state
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all customers when component mounts
  useEffect(() => {
    loadCustomers();
  }, []);

  // Sync with external value
  useEffect(() => {
    if (value && !selectedCustomer) {
      // Check if the value matches any customer
      const matchingCustomer = customers.find((c) => c.name === value);
      if (matchingCustomer) {
        setSelectedCustomer(matchingCustomer);
        setShowCustomInput(false);
        setQuery(matchingCustomer.name);
      } else {
        // It's a custom name
        setCustomName(value);
        setShowCustomInput(true);
      }
    }
  }, [value, customers, selectedCustomer]);

  // Close the results list when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No auth token found");
        // Use fallback customers if no token
        setCustomers(FALLBACK_CUSTOMERS);
        setLoading(false);
        return;
      }

      // Load ALL customers from the customers API (not just today's stops)
      const response = await fetch("/api/admin/customers?limit=1000", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.customers && Array.isArray(data.customers)) {
          // Convert API response to our Customer interface
          const customerList = data.customers
            .map((customer: any) => ({
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.contactInfo, // API uses contactInfo field
              address: customer.address,
              groupCode: customer.groupCode,
            }))
            .sort((a: Customer, b: Customer) => a.name.localeCompare(b.name));

          setCustomers(customerList);
          console.log(`✅ Loaded ${customerList.length} customers from database`);
        } else {
          console.warn("No customers found in API response, using fallback");
          setCustomers(FALLBACK_CUSTOMERS);
        }
      } else {
        console.error("Failed to load customers from API, using fallback");
        setCustomers(FALLBACK_CUSTOMERS);
      }
    } catch (error) {
      console.error("Error loading customers, using fallback:", error);
      setCustomers(FALLBACK_CUSTOMERS);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers =
    query.trim() === ""
      ? customers
      : customers.filter((c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase())
        );

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomInput(false);
    setCustomName("");
    setQuery(customer.name);
    setIsOpen(false);
    onChange(customer.name, customer);
  };

  const selectCustomOption = () => {
    setSelectedCustomer(null);
    setShowCustomInput(true);
    setCustomName("");
    setQuery("");
    setIsOpen(false);
    onChange("");
    // Focus the custom-name input on the next tick
    setTimeout(() => {
      document.getElementById("customer-custom-name-input")?.focus();
    }, 0);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);
    setHighlightedIndex(0);
    if (selectedCustomer) {
      // User is typing again after having selected someone; clear the selection
      setSelectedCustomer(null);
      onChange("");
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;

    const optionsCount = filteredCustomers.length + 1; // +1 for "Enter custom name"

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % optionsCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + optionsCount) % optionsCount);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex === filteredCustomers.length) {
        selectCustomOption();
      } else if (filteredCustomers[highlightedIndex]) {
        selectCustomer(filteredCustomers[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setCustomName(name);
    onChange(name);
  };

  return (
    <div className="space-y-2">
      {/* Searchable Customer Combobox */}
      <div className="relative" ref={containerRef}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleQueryChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Loading customers..." : placeholder}
          required={required && !showCustomInput}
          disabled={loading}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
        />

        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {isOpen && !loading && (
          <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-md border border-gray-300 bg-white shadow-lg">
            {filteredCustomers.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">No customers match your search.</li>
            )}
            {filteredCustomers.map((customer, index) => (
              <li
                key={customer.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCustomer(customer);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`px-3 py-2 text-sm cursor-pointer ${
                  index === highlightedIndex ? "bg-blue-100" : "hover:bg-gray-100"
                }`}
              >
                {customer.name}
                {customer.groupCode && ` (${customer.groupCode})`}
              </li>
            ))}
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                selectCustomOption();
              }}
              onMouseEnter={() => setHighlightedIndex(filteredCustomers.length)}
              className={`px-3 py-2 text-sm cursor-pointer border-t border-gray-200 text-blue-600 ${
                highlightedIndex === filteredCustomers.length ? "bg-blue-100" : "hover:bg-gray-100"
              }`}
            >
              + Enter custom name
            </li>
          </ul>
        )}
      </div>

      {/* Custom Name Input */}
      {showCustomInput && (
        <div>
          <input
            id="customer-custom-name-input"
            type="text"
            value={customName}
            onChange={handleCustomNameChange}
            placeholder="Enter customer name..."
            required={required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Entering a new customer name</p>
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
