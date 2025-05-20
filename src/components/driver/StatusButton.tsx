'use client';

import React from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface StatusButtonProps {
  status: string;
  targetStatus: string;
  currentStatus: string;
  isUpdating: boolean;
  isDisabled: boolean;
  onClick: () => void;
  label: string;
  className?: string;
}

export default function StatusButton({
  status,
  targetStatus,
  currentStatus,
  isUpdating,
  isDisabled,
  onClick,
  label,
  className = ''
}: StatusButtonProps) {
  const baseClasses = "py-2 px-4 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-200";
  
  // Determine button color based on status
  let colorClasses = "";
  switch (targetStatus) {
    case "ON_THE_WAY":
      colorClasses = "bg-blue-600 hover:bg-blue-700";
      break;
    case "ARRIVED":
      colorClasses = "bg-yellow-600 hover:bg-yellow-700";
      break;
    case "COMPLETED":
      colorClasses = "bg-green-600 hover:bg-green-700";
      break;
    default:
      colorClasses = "bg-gray-600 hover:bg-gray-700";
  }

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${colorClasses} ${className}`}
    >
      {isUpdating && status === currentStatus ? (
        <span className="flex items-center justify-center">
          <LoadingSpinner size="sm" className="-ml-1 mr-2 text-white" />
          Updating...
        </span>
      ) : (
        label
      )}
    </button>
  );
}
