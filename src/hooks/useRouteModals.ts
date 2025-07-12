import { useState } from "react";

/**
 * Custom hook for managing all modal states in route details
 * Extracted to reduce state complexity in main component
 */
export function useRouteModals() {
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteWarning, setDeleteWarning] = useState<{
    message: string;
    completedStops: number;
    totalStops: number;
  } | null>(null);

  // Email results modal state
  const [showEmailResults, setShowEmailResults] = useState(false);
  const [emailResults, setEmailResults] = useState<any>(null);

  // Add stop modal state
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [addStopForm, setAddStopForm] = useState({
    customerNameFromUpload: "",
    driverId: "",
    orderNumberWeb: "",
    quickbooksInvoiceNum: "",
    initialDriverNotes: "",
    isCOD: false,
    amount: "",
    address: "",
    contactInfo: "",
  });
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [addingStop, setAddingStop] = useState(false);

  // Reset functions
  const resetDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteError("");
    setDeleteWarning(null);
    setDeleteLoading(false);
  };

  const resetAddStopModal = () => {
    setAddStopForm({
      customerNameFromUpload: "",
      driverId: "",
      orderNumberWeb: "",
      quickbooksInvoiceNum: "",
      initialDriverNotes: "",
      isCOD: false,
      amount: "",
      address: "",
      contactInfo: "",
    });
    setSelectedCustomer(null);
    setShowAddStopModal(false);
    setAddingStop(false);
  };

  const resetEmailResults = () => {
    setShowEmailResults(false);
    setEmailResults(null);
  };

  return {
    // Delete dialog
    showDeleteDialog,
    setShowDeleteDialog,
    deleteLoading,
    setDeleteLoading,
    deleteError,
    setDeleteError,
    deleteWarning,
    setDeleteWarning,
    resetDeleteDialog,

    // Email results
    showEmailResults,
    setShowEmailResults,
    emailResults,
    setEmailResults,
    resetEmailResults,

    // Add stop modal
    showAddStopModal,
    setShowAddStopModal,
    addStopForm,
    setAddStopForm,
    selectedCustomer,
    setSelectedCustomer,
    addingStop,
    setAddingStop,
    resetAddStopModal,
  };
}
