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
                  Column Mapping Reference
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-mono-600 mb-3">
                    The system will map the following columns from your Excel file:
                  </p>
                  <div className="bg-mono-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs font-medium text-mono-700">Column</div>
                      <div className="text-xs font-medium text-mono-700">Maps To</div>
                      
                      <div className="text-xs text-mono-600">Column B</div>
                      <div className="text-xs text-mono-800">Route Number</div>
                      
                      <div className="text-xs text-mono-600">Column C</div>
                      <div className="text-xs text-mono-800">Assigned Driver</div>
                      
                      <div className="text-xs text-mono-600">Column F</div>
                      <div className="text-xs text-mono-800">Customer Name</div>
                      
                      <div className="text-xs text-mono-600">Column BB</div>
                      <div className="text-xs text-mono-800">Customer Group Code</div>
                      
                      <div className="text-xs text-mono-600">Column P</div>
                      <div className="text-xs text-mono-800">Web Order/Orders #</div>
                      
                      <div className="text-xs text-mono-600">Column AC</div>
                      <div className="text-xs text-mono-800">Notes for Driver</div>
                      
                      <div className="text-xs text-mono-600">Column AI</div>
                      <div className="text-xs text-mono-800">QuickBooks Invoice #</div>
                      
                      <div className="text-xs text-mono-600">Column AA</div>
                      <div className="text-xs text-mono-800">COD Account Flag</div>
                      
                      <div className="text-xs text-mono-600">Column AK</div>
                      <div className="text-xs text-mono-800">Cash Payment Flag</div>
                      
                      <div className="text-xs text-mono-600">Column AL</div>
                      <div className="text-xs text-mono-800">Check Payment Flag</div>
                      
                      <div className="text-xs text-mono-600">Column AM</div>
                      <div className="text-xs text-mono-800">Credit Card Payment Flag</div>
                      
                      <div className="text-xs text-mono-600">Column AQ</div>
                      <div className="text-xs text-mono-800">Return Flag</div>
                      
                      <div className="text-xs text-mono-600">Column AR</div>
                      <div className="text-xs text-mono-800">Driver Remark</div>
                      
                      <div className="text-xs text-mono-600">Column AJ</div>
                      <div className="text-xs text-mono-800">Amount</div>
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
