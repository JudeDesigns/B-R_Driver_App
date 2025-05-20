'use client';

import React from 'react';

interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  onClose?: () => void;
  className?: string;
  isVisible: boolean;
}

export default function Notification({
  type,
  message,
  title,
  onClose,
  className = '',
  isVisible
}: NotificationProps) {
  if (!isVisible) return null;

  const typeStyles = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700',
  };

  return (
    <div className={`fixed top-4 right-4 left-4 md:left-auto md:w-80 ${typeStyles[type]} border-l-4 p-4 rounded shadow-lg z-50 animate-fade-in ${className}`}>
      <div className="flex justify-between items-start">
        <div>
          {title && <p className="font-bold">{title}</p>}
          <p className="text-sm">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close notification"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
