"use client";

import { useState, useEffect } from "react";

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ColumnMappingModal({
  isOpen,
  onClose,
}: ColumnMappingModalProps) {
  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black opacity-50"></div>
        </div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-mono-800 mb-4">
                  Excel Column Mapping Guide
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-mono-600 mb-3">
                    The system maps data from your Excel file using the following column headers and fixed positions. Only these fields are currently imported and used:
                  </p>
                  <div className="bg-mono-50 p-4 rounded-lg">
                    <div className="text-xs text-mono-600 mb-3">
                      <strong>Note:</strong> The system uses header-based mapping with fallback to fixed column positions for critical fields.
                    </div>

                    <div className="space-y-4">
                      {/* Core Route Information */}
                      <div>
                        <div className="text-xs font-semibold text-mono-800 mb-2">📋 Route Information</div>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          <div className="text-xs text-mono-600">Header: "Route #"</div>
                          <div className="text-xs text-mono-800">Route Number</div>

                          <div className="text-xs text-mono-600">Column C (Fixed)</div>
                          <div className="text-xs text-mono-800">Assigned Driver</div>

                          <div className="text-xs text-mono-600">Header: "S No"</div>
                          <div className="text-xs text-mono-800">Stop Sequence</div>
                        </div>
                      </div>

                      {/* Customer Information */}
                      <div>
                        <div className="text-xs font-semibold text-mono-800 mb-2">👥 Customer Information</div>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          <div className="text-xs text-mono-600">Header: "Customers"</div>
                          <div className="text-xs text-mono-800">Customer Name</div>

                          <div className="text-xs text-mono-600">Header: "Customer GROUP CODE"</div>
                          <div className="text-xs text-mono-800">Customer Group Code</div>

                          <div className="text-xs text-mono-600">Header: "Customer Email"</div>
                          <div className="text-xs text-mono-800">Customer Email</div>
                        </div>
                      </div>

                      {/* Order Information */}
                      <div>
                        <div className="text-xs font-semibold text-mono-800 mb-2">📦 Order Information</div>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          <div className="text-xs text-mono-600">Header: "Order # (Web)"</div>
                          <div className="text-xs text-mono-800">Web Order Number</div>

                          <div className="text-xs text-mono-600">Column AI (Fixed)</div>
                          <div className="text-xs text-mono-800">QuickBooks Invoice #</div>

                          <div className="text-xs text-mono-600">Header: "Amount"</div>
                          <div className="text-xs text-mono-800">Order Amount</div>
                        </div>
                      </div>

                      {/* Payment Information */}
                      <div>
                        <div className="text-xs font-semibold text-mono-800 mb-2">💳 Payment Information</div>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          <div className="text-xs text-mono-600">Header: "COD Account/ Send Inv to Customer"</div>
                          <div className="text-xs text-mono-800">COD Flag</div>

                          <div className="text-xs text-mono-600">Header: "Cash"</div>
                          <div className="text-xs text-mono-800">Cash Payment Flag</div>

                          <div className="text-xs text-mono-600">Header: "Check"</div>
                          <div className="text-xs text-mono-800">Check Payment Flag</div>

                          <div className="text-xs text-mono-600">Header: "Credit Card"</div>
                          <div className="text-xs text-mono-800">Credit Card Payment Flag</div>

                          <div className="text-xs text-mono-600">Column AK (Fixed)</div>
                          <div className="text-xs text-mono-800">Cash Payment Amount</div>

                          <div className="text-xs text-mono-600">Column AL (Fixed)</div>
                          <div className="text-xs text-mono-800">Check Payment Amount</div>

                          <div className="text-xs text-mono-600">Column AM (Fixed)</div>
                          <div className="text-xs text-mono-800">Credit Card Payment Amount</div>
                        </div>
                      </div>

                      {/* Notes and Remarks */}
                      <div>
                        <div className="text-xs font-semibold text-mono-800 mb-2">📝 Notes and Remarks</div>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          <div className="text-xs text-mono-600">Header: "NOTES to be updated at top of the INVOICE"</div>
                          <div className="text-xs text-mono-800">Initial Driver Notes</div>

                          <div className="text-xs text-mono-600">Header: "Notes for Drivers"</div>
                          <div className="text-xs text-mono-800">Admin Notes (Creates Admin Note)</div>

                          <div className="text-xs text-mono-600">Header: "Other Remarks"</div>
                          <div className="text-xs text-mono-800">Driver Remarks</div>
                        </div>
                      </div>

                      {/* Returns */}
                      <div>
                        <div className="text-xs font-semibold text-mono-800 mb-2">🔄 Returns</div>
                        <div className="grid grid-cols-2 gap-2 ml-2">
                          <div className="text-xs text-mono-600">Header: "Payments & Returns Remarks"</div>
                          <div className="text-xs text-mono-800">Return Flag</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-mono-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-black text-base font-medium text-white hover:bg-mono-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue sm:ml-3 sm:w-auto sm:text-sm transition duration-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
