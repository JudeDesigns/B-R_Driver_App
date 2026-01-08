/**
 * Invoice validation utilities for document uploads
 * Provides warnings and validation for invoice documents
 */

export interface InvoiceValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  severity: 'error' | 'warning' | 'info';
}

export interface InvoiceData {
  invoiceNumber?: string;
  invoiceAmount?: string;
  documentType: string;
  fileName: string;
}

export interface CreditMemoData {
  creditMemoNumber?: string;
  creditMemoAmount?: string;
  documentType: string;
  fileName: string;
}

/**
 * Validates invoice data and returns warnings/errors
 */
export function validateInvoiceData(data: InvoiceData): InvoiceValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isValid = true;
  let severity: 'error' | 'warning' | 'info' = 'info';

  // Check if this is an invoice document
  if (data.documentType === 'INVOICE') {
    // Check for missing invoice number
    if (!data.invoiceNumber || data.invoiceNumber.trim() === '') {
      warnings.push('Invoice number is missing. This may cause issues with tracking and accounting.');
      severity = 'warning';
    }

    // Check for missing invoice amount/total
    if (!data.invoiceAmount || data.invoiceAmount.trim() === '') {
      warnings.push('Invoice amount/total is missing. This may cause issues with payment processing and reconciliation.');
      severity = 'warning';
    }

    // Validate invoice amount format if provided
    if (data.invoiceAmount && data.invoiceAmount.trim() !== '') {
      const amount = parseFloat(data.invoiceAmount.replace(/[,$]/g, ''));
      if (isNaN(amount)) {
        warnings.push('Invoice amount format is invalid. Please enter a valid number (e.g., 100.50).');
        severity = 'warning';
      } else if (amount <= 0) {
        warnings.push('Invoice amount should be greater than zero.');
        severity = 'warning';
      }
    }

    // Check invoice number format (basic validation)
    if (data.invoiceNumber && data.invoiceNumber.trim() !== '') {
      const invoiceNum = data.invoiceNumber.trim();
      if (invoiceNum.length < 3) {
        warnings.push('Invoice number seems too short. Please verify it is correct.');
        severity = 'warning';
      }
    }

    // File name validation for invoices
    const fileName = data.fileName.toLowerCase();
    if (!fileName.includes('invoice') && !fileName.includes('inv')) {
      warnings.push('File name does not contain "invoice" or "inv". Consider renaming for better organization.');
      severity = 'warning';
    }
  }

  return {
    isValid,
    warnings,
    errors,
    severity
  };
}

/**
 * Formats validation messages for display
 */
export function formatValidationMessages(result: InvoiceValidationResult): string {
  const messages: string[] = [];
  
  if (result.errors.length > 0) {
    messages.push('Errors:');
    result.errors.forEach(error => messages.push(`• ${error}`));
  }
  
  if (result.warnings.length > 0) {
    if (messages.length > 0) messages.push('');
    messages.push('Warnings:');
    result.warnings.forEach(warning => messages.push(`• ${warning}`));
  }
  
  return messages.join('\n');
}

/**
 * Gets the appropriate CSS classes for validation severity
 */
export function getValidationSeverityClasses(severity: 'error' | 'warning' | 'info'): {
  containerClass: string;
  iconClass: string;
  textClass: string;
} {
  switch (severity) {
    case 'error':
      return {
        containerClass: 'bg-red-50 border-red-200',
        iconClass: 'text-red-400',
        textClass: 'text-red-800'
      };
    case 'warning':
      return {
        containerClass: 'bg-yellow-50 border-yellow-200',
        iconClass: 'text-yellow-400',
        textClass: 'text-yellow-800'
      };
    default:
      return {
        containerClass: 'bg-blue-50 border-blue-200',
        iconClass: 'text-blue-400',
        textClass: 'text-blue-800'
      };
  }
}

/**
 * Checks if upload should be blocked based on validation result
 */
export function shouldBlockUpload(result: InvoiceValidationResult): boolean {
  return result.errors.length > 0;
}

/**
 * Checks if user confirmation is needed before upload
 */
export function needsUserConfirmation(result: InvoiceValidationResult): boolean {
  return result.warnings.length > 0;
}

/**
 * Validates credit memo data and returns warnings/errors
 */
export function validateCreditMemoData(data: CreditMemoData): InvoiceValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  let isValid = true;
  let severity: 'error' | 'warning' | 'info' = 'info';

  // Check if this is a credit memo document
  if (data.documentType === 'CREDIT_MEMO') {
    // Check for missing credit memo number
    if (!data.creditMemoNumber || data.creditMemoNumber.trim() === '') {
      warnings.push('Credit memo number is missing. This may cause issues with tracking and accounting.');
      severity = 'warning';
    }

    // Check for missing credit memo amount/total
    if (!data.creditMemoAmount || data.creditMemoAmount.trim() === '') {
      warnings.push('Credit memo amount is missing. This may cause issues with credit processing and reconciliation.');
      severity = 'warning';
    }

    // Validate credit memo amount format if provided
    if (data.creditMemoAmount && data.creditMemoAmount.trim() !== '') {
      const amount = parseFloat(data.creditMemoAmount.replace(/[,$]/g, ''));
      if (isNaN(amount)) {
        warnings.push('Credit memo amount format is invalid. Please enter a valid number (e.g., 100.50).');
        severity = 'warning';
      } else if (amount <= 0) {
        warnings.push('Credit memo amount should be greater than zero.');
        severity = 'warning';
      }
    }

    // Check credit memo number format (basic validation)
    if (data.creditMemoNumber && data.creditMemoNumber.trim() !== '') {
      const memoNum = data.creditMemoNumber.trim();
      if (memoNum.length < 3) {
        warnings.push('Credit memo number seems too short. Please verify it is correct.');
        severity = 'warning';
      }
    }

    // File name validation for credit memos
    const fileName = data.fileName.toLowerCase();
    if (!fileName.includes('credit') && !fileName.includes('memo') && !fileName.includes('cm')) {
      warnings.push('File name does not contain "credit", "memo", or "cm". Consider renaming for better organization.');
      severity = 'warning';
    }
  }

  return {
    isValid,
    warnings,
    errors,
    severity
  };
}
