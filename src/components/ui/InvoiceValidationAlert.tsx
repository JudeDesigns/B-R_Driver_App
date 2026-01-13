'use client';

import React from 'react';
import { InvoiceValidationResult, getValidationSeverityClasses } from '@/utils/invoiceValidation';

interface InvoiceValidationAlertProps {
  validationResult: InvoiceValidationResult;
  onConfirm?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
  className?: string;
}

export default function InvoiceValidationAlert({
  validationResult,
  onConfirm,
  onCancel,
  showActions = false,
  className = ''
}: InvoiceValidationAlertProps) {
  const { containerClass, iconClass, textClass } = getValidationSeverityClasses(validationResult.severity);

  if (validationResult.warnings.length === 0 && validationResult.errors.length === 0) {
    return null;
  }

  const getIcon = () => {
    switch (validationResult.severity) {
      case 'error':
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className={`w-5 h-5 ${iconClass}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getTitle = () => {
    switch (validationResult.severity) {
      case 'error':
        return 'Upload Error';
      case 'warning':
        return 'Upload Warning';
      default:
        return 'Upload Information';
    }
  };

  return (
    <div className={`rounded-md border p-4 ${containerClass} ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${textClass}`}>
            {getTitle()}
          </h3>
          <div className={`mt-2 text-sm ${textClass}`}>
            {validationResult.errors.length > 0 && (
              <div className="mb-2">
                <p className="font-medium">Errors:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {validationResult.warnings.length > 0 && (
              <div>
                <p className="font-medium">Warnings:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {showActions && validationResult.warnings.length > 0 && (
            <div className="mt-4 flex space-x-3">
              <button
                type="button"
                onClick={onConfirm}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Upload Anyway
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
