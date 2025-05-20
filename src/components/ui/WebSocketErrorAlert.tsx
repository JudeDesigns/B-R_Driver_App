"use client";

import React from "react";

interface WebSocketErrorAlertProps {
  error: string | null;
  onReconnect: () => void;
}

export default function WebSocketErrorAlert({
  error,
  onReconnect,
}: WebSocketErrorAlertProps) {
  if (!error) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            WebSocket Connection Error
          </h3>
          <div className="mt-1 text-sm text-red-700">
            <p>{error}</p>
          </div>
          <div className="mt-3">
            <button
              onClick={onReconnect}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Reconnect
            </button>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className="bg-red-50 rounded-md inline-flex text-red-400 hover:text-red-500 focus:outline-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onReconnect(); // Also reconnect when closing
            }}
          >
            <span className="sr-only">Close</span>
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
