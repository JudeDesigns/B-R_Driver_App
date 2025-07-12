import { useState } from "react";

/**
 * Custom hook for managing route operation states
 * Handles export, email sending, and image report generation states
 */
export function useRouteOperations() {
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Email sending state
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  // Image report generation state
  const [isGeneratingImageReport, setIsGeneratingImageReport] = useState(false);

  // Reset functions
  const resetExportError = () => {
    setExportError("");
  };

  return {
    // Export
    exporting,
    setExporting,
    exportError,
    setExportError,
    resetExportError,

    // Email sending
    isSendingEmails,
    setIsSendingEmails,

    // Image report
    isGeneratingImageReport,
    setIsGeneratingImageReport,
  };
}
