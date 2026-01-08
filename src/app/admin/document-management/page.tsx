"use client";

import React, { useState, useEffect } from 'react';
import Notification from '@/components/ui/Notification';
import InvoiceValidationAlert from '@/components/ui/InvoiceValidationAlert';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { validateInvoiceData, validateCreditMemoData, shouldBlockUpload, needsUserConfirmation, InvoiceValidationResult } from '@/utils/invoiceValidation';

interface Customer {
  id: string;
  name: string;
  email: string;
  groupCode: string;
}

interface Driver {
  id: string;
  username: string;
  fullName: string;
}

interface Route {
  id: string;
  routeNumber: string;
  driver?: Driver;
}

interface Stop {
  id: string;
  sequence: number;
  customerNameFromUpload: string;
  driverNameFromUpload?: string;
  status: string;
  address: string;
  customer: {
    id: string;
    name: string;
    groupCode: string;
    documents?: Document[];
  };
  route: {
    id: string;
    routeNumber: string;
    date: string;
    driver?: Driver;
  };
  stopDocuments: Array<{
    id: string;
    document: {
      id: string;
      title: string;
      type: string;
      fileName: string;
      filePath: string; // Added for document viewing functionality
      createdAt: string; // Upload timestamp
    };
  }>;
  _count: {
    stopDocuments: number;
  };
}

interface Document {
  id: string;
  title: string;
  description: string;
  type: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  customerId?: string;
  customer?: Customer;
  isActive: boolean;
}

export default function DocumentManagementPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'customer' | 'stop'>('customer');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<'customer' | 'stop'>('customer');
  const [selectedCustomerForUpload, setSelectedCustomerForUpload] = useState<string>('');
  const [selectedStopForUpload, setSelectedStopForUpload] = useState<string>('');
  const [showStopDetailsModal, setShowStopDetailsModal] = useState(false);
  const [selectedStopForDetails, setSelectedStopForDetails] = useState<Stop | null>(null);

  // Invoice-specific fields for stop documents
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceAmount, setInvoiceAmount] = useState<string>('');

  // Credit Memo-specific fields for stop documents
  const [creditMemoNumber, setCreditMemoNumber] = useState<string>('');
  const [creditMemoAmount, setCreditMemoAmount] = useState<string>('');

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  // Document management states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Invoice validation state
  const [validationResult, setValidationResult] = useState<InvoiceValidationResult | null>(null);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<boolean>(false);

  // Notification state
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });

  const showNotification = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    setNotification({ show: true, type, title, message });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  // Document management functions
  const handleViewDocument = (doc: any) => {
    window.open(doc.filePath, '_blank');
  };

  const handleEditDocument = (doc: any) => {
    setSelectedDocument(doc);
    setShowEditModal(true);
  };

  const handleDeleteDocument = (doc: any) => {
    setSelectedDocument(doc);
    setShowDeleteModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedDocument) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;
    const isActive = formData.get('isActive') === 'true';

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        return;
      }

      const response = await fetch(`/api/admin/documents/${selectedDocument.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          type,
          isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Update failed');
      }

      showNotification('success', 'Success', 'Document updated successfully');
      setShowEditModal(false);
      setSelectedDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error updating document:', error);
      showNotification('error', 'Error', error instanceof Error ? error.message : 'Failed to update document');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDocument) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        return;
      }

      const response = await fetch(`/api/admin/documents/${selectedDocument.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Delete failed');
      }

      showNotification('success', 'Success', 'Document deleted successfully');
      setShowDeleteModal(false);
      setSelectedDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      showNotification('error', 'Error', error instanceof Error ? error.message : 'Failed to delete document');
    }
  };

  // Document types - filtered based on upload type
  const allDocumentTypes = [
    { value: "INVOICE", label: "Invoice" },
    { value: "CREDIT_MEMO", label: "Credit Memo" },
    { value: "PURCHASE_ORDER", label: "P.O. (Purchase Order)" },
    { value: "DELIVERY_RECEIPT", label: "Statement" },
    { value: "RETURN_FORM", label: "Return Form" },
    { value: "OTHER", label: "Other" },
  ];

  // Filter document types based on upload type
  const documentTypes = uploadType === 'customer'
    ? allDocumentTypes.filter(type => type.value !== 'INVOICE') // Hide Invoice for customer documents
    : allDocumentTypes; // Show all types for stop documents

  // Function to get proper document type label
  const getDocumentTypeLabel = (type: string) => {
    const docType = documentTypes.find(dt => dt.value === type);
    return docType ? docType.label : type.replace('_', ' ');
  };

  useEffect(() => {
    fetchDocuments();
    fetchCustomers();
    fetchTodaysStops();
  }, []);

  const fetchTodaysStops = async () => {
    try {
      // Get token from localStorage or sessionStorage
      let token;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
      }

      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        return;
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (selectedDriver) params.append('driver', selectedDriver);
      if (selectedRoute) params.append('route', selectedRoute);

      const response = await fetch(`/api/admin/stops/today?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStops(data.stops || []);
        setDrivers(data.drivers || []);
        setRoutes(data.routes || []);
      } else {
        showNotification('error', 'Error', 'Failed to fetch today\'s stops');
      }
    } catch (error) {
      console.error('Error fetching today\'s stops:', error);
      showNotification('error', 'Error', 'Failed to fetch today\'s stops');
    }
  };

  // Refetch stops when filters change
  useEffect(() => {
    if (activeTab === 'stop') {
      fetchTodaysStops();
    }
  }, [selectedDriver, selectedRoute, activeTab]);

  const handleViewStopDetails = (stop: Stop) => {
    setSelectedStopForDetails(stop);
    setShowStopDetailsModal(true);
  };

  // Handle stop document deletion
  const handleDeleteStopDocument = async (documentId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        return;
      }

      const response = await fetch(`/api/admin/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to delete document: ${response.status} - ${errorData}`);
      }

      showNotification('success', 'Success', 'Document deleted successfully');

      // Refresh the stops data
      const stopsResponse = await fetch('/api/admin/stops/today', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (stopsResponse.ok) {
        const stopsData = await stopsResponse.json();
        setStops(stopsData);
      }

      // Close the modal and reset states
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);

    } catch (error) {
      console.error('Error deleting document:', error);
      showNotification('error', 'Error', 'Failed to delete document');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;

    if (!file || !title || !type) {
      showNotification('error', 'Validation Error', 'File, title, and type are required');
      return;
    }

    if (uploadType === 'customer' && !selectedCustomerForUpload) {
      showNotification('error', 'Validation Error', 'Please select a customer for customer documents');
      return;
    }

    if (uploadType === 'stop' && !selectedStopForUpload) {
      showNotification('error', 'Validation Error', 'Please select a stop for stop-specific documents');
      return;
    }

    // Validate invoice data if this is an invoice document
    if (type === 'INVOICE') {
      const validation = validateInvoiceData({
        invoiceNumber,
        invoiceAmount,
        documentType: type,
        fileName: file.name
      });

      // Block upload if there are errors
      if (shouldBlockUpload(validation)) {
        setValidationResult(validation);
        setShowValidationAlert(true);
        return;
      }

      // Show warning and ask for confirmation if there are warnings
      if (needsUserConfirmation(validation) && !pendingUpload) {
        setValidationResult(validation);
        setShowValidationAlert(true);
        setPendingUpload(true);
        return;
      }
    }

    // Validate credit memo data if this is a credit memo document
    if (type === 'CREDIT_MEMO') {
      const validation = validateCreditMemoData({
        creditMemoNumber,
        creditMemoAmount,
        documentType: type,
        fileName: file.name
      });

      // Block upload if there are errors
      if (shouldBlockUpload(validation)) {
        setValidationResult(validation);
        setShowValidationAlert(true);
        return;
      }

      // Show warning and ask for confirmation if there are warnings
      if (needsUserConfirmation(validation) && !pendingUpload) {
        setValidationResult(validation);
        setShowValidationAlert(true);
        setPendingUpload(true);
        return;
      }
    }

    try {
      // Get token
      let token;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
      }

      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        return;
      }

      // Upload the document
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('title', title);
      uploadFormData.append('description', description);
      uploadFormData.append('type', type);

      if (uploadType === 'customer') {
        uploadFormData.append('customerId', selectedCustomerForUpload);
      } else if (uploadType === 'stop') {
        uploadFormData.append('stopId', selectedStopForUpload);

        // Add invoice-specific data if this is an invoice document
        if (type === 'INVOICE') {
          uploadFormData.append('invoiceNumber', invoiceNumber);
          uploadFormData.append('invoiceAmount', invoiceAmount);
        }

        // Add credit memo-specific data if this is a credit memo document
        if (type === 'CREDIT_MEMO') {
          uploadFormData.append('creditMemoNumber', creditMemoNumber);
          uploadFormData.append('creditMemoAmount', creditMemoAmount);
        }
      }

      const response = await fetch('/api/admin/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      await response.json();

      // Show success message
      if (uploadType === 'stop') {
        showNotification('success', 'Success', 'Stop-specific document uploaded successfully');
      } else {
        showNotification('success', 'Success', 'Customer document uploaded successfully');
      }

      // Reset form and close modal
      setShowUploadModal(false);
      setSelectedCustomerForUpload('');
      setSelectedStopForUpload('');
      setUploadType('customer');
      setSelectedDocumentType('');
      setInvoiceNumber('');
      setInvoiceAmount('');
      setCreditMemoNumber('');
      setCreditMemoAmount('');

      // Refresh data
      fetchDocuments();
      if (activeTab === 'stop') {
        fetchTodaysStops();
      }

    } catch (error) {
      console.error('Upload error:', error);
      showNotification('error', 'Upload Failed', error instanceof Error ? error.message : 'Failed to upload document');
    } finally {
      // Reset validation states
      setPendingUpload(false);
      setShowValidationAlert(false);
      setValidationResult(null);
    }
  };

  const handleValidationConfirm = () => {
    setShowValidationAlert(false);
    setPendingUpload(true);
    // Re-trigger the form submission
    const form = document.querySelector('form[data-upload-form]') as HTMLFormElement;
    if (form) {
      form.requestSubmit();
    }
  };

  const handleValidationCancel = () => {
    setShowValidationAlert(false);
    setPendingUpload(false);
    setValidationResult(null);
  };

  const fetchDocuments = async () => {
    try {
      // Get token from localStorage or sessionStorage
      let token;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
      }

      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      } else {
        showNotification('error', 'Error', 'Failed to fetch documents');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      showNotification('error', 'Error', 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      // Get token from localStorage or sessionStorage
      let token;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
      }

      if (!token) {
        showNotification('error', 'Authentication Error', 'Please log in again');
        return;
      }

      const response = await fetch('/api/admin/customers?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
      } else {
        showNotification('error', 'Error', 'Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      showNotification('error', 'Error', 'Failed to fetch customers');
    }
  };

  const customerDocuments = documents.filter(doc => doc.customerId);

  const filteredCustomerDocuments = selectedCustomer
    ? customerDocuments.filter(doc => doc.customerId === selectedCustomer)
    : customerDocuments;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';

    return date.toLocaleString('en-US', {
      timeZone: "America/Los_Angeles",
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notification */}
      <Notification
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.show}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
            <p className="text-gray-600 mt-1">
              Manage customer-level and stop-specific documents for driver printing
            </p>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Upload Document
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('customer')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'customer'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Customer Documents ({customerDocuments.length})
            </button>
            <button
              onClick={() => setActiveTab('stop')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'stop'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Today's Stops ({stops.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'customer' && (
            <div className="space-y-6">
              {/* Customer Filter */}
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Filter by Customer:</label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Customers</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.groupCode && `(${customer.groupCode})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Documents */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-blue-800 mb-2">Customer-Level Documents</h3>
                <p className="text-blue-700 text-sm">
                  These documents are uploaded for specific customers and will be available for all their deliveries.
                  Drivers will see these documents at every stop for the associated customer.
                </p>
              </div>

              {filteredCustomerDocuments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No customer documents found</p>
                  <p className="text-sm">Upload documents for specific customers to get started</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredCustomerDocuments.map(doc => (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {getDocumentTypeLabel(doc.type)}
                            </span>
                            {!doc.isActive && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{doc.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Customer: {doc.customer?.name}</span>
                            <span>File: {doc.fileName}</span>
                            <span>Size: {formatFileSize(doc.fileSize)}</span>
                            <span>Uploaded: {formatDate(doc.uploadedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDocument(doc)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleEditDocument(doc)}
                            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(doc)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stop' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-green-800 mb-2">Today's Delivery Stops</h3>
                <p className="text-green-700 text-sm">
                  Assign documents to specific delivery stops for today's routes. Documents will be available to drivers at those specific stops.
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Driver:</label>
                  <select
                    value={selectedDriver}
                    onChange={(e) => setSelectedDriver(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">All Drivers</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.username}>
                        {driver.fullName || driver.username}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Route:</label>
                  <select
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">All Routes</option>
                    {routes.map(route => (
                      <option key={route.id} value={route.id}>
                        Route {route.routeNumber} {route.driver && `(${route.driver.fullName || route.driver.username})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {stops.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No delivery stops found for today</p>
                  <p className="text-sm">Stops will appear here when routes are uploaded for today</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {stops.map(stop => (
                    <div key={stop.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 text-xs font-medium">
                              {stop.sequence}
                            </span>
                            <h3 className="font-semibold text-gray-900">{stop.customerNameFromUpload}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              Route {stop.route.routeNumber}
                            </span>
                            {stop._count.stopDocuments > 0 && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                {stop._count.stopDocuments} document{stop._count.stopDocuments !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                            <span>Customer: {stop.customer.name}</span>
                            {stop.customer.groupCode && <span>Group: {stop.customer.groupCode}</span>}
                            <span>Driver: {stop.driverNameFromUpload || stop.route.driver?.fullName || stop.route.driver?.username || 'Unassigned'}</span>
                          </div>
                          {stop.stopDocuments.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-600 mb-1">Assigned Documents:</p>
                              <div className="flex flex-wrap gap-1">
                                {stop.stopDocuments.map(stopDoc => (
                                  <span key={stopDoc.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded" title={`Uploaded: ${formatDate(stopDoc.document.createdAt)}`}>
                                    {stopDoc.document.title} <span className="text-gray-500 ml-1">({new Date(stopDoc.document.createdAt).toLocaleDateString()})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewStopDetails(stop)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View Documents
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Upload Document</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="space-y-4" data-upload-form>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="uploadType"
                        value="customer"
                        checked={uploadType === 'customer'}
                        onChange={(e) => setUploadType(e.target.value as 'customer' | 'stop')}
                        className="mr-2"
                      />
                      Customer Document
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="uploadType"
                        value="stop"
                        checked={uploadType === 'stop'}
                        onChange={(e) => setUploadType(e.target.value as 'customer' | 'stop')}
                        className="mr-2"
                      />
                      Stop-Specific
                    </label>
                  </div>
                </div>

                {uploadType === 'customer' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Customer
                    </label>
                    <SearchableSelect
                      options={customers.map(customer => ({
                        value: customer.id,
                        label: `${customer.name}${customer.groupCode ? ` (${customer.groupCode})` : ''}`,
                        searchText: `${customer.name} ${customer.groupCode || ''} ${customer.email || ''}`
                      }))}
                      value={selectedCustomerForUpload}
                      onChange={setSelectedCustomerForUpload}
                      placeholder="Search for a customer..."
                      required
                      emptyMessage="No customers available. Create customers first."
                    />
                  </div>
                )}

                {uploadType === 'stop' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Stop
                    </label>
                    <SearchableSelect
                      options={stops.map(stop => ({
                        value: stop.id,
                        label: `Route ${stop.route.routeNumber} - Stop ${stop.sequence}: ${stop.customerNameFromUpload}`,
                        searchText: `Route ${stop.route.routeNumber} Stop ${stop.sequence} ${stop.customerNameFromUpload} ${stop.driverNameFromUpload || ''} ${stop.address || ''}`
                      }))}
                      value={selectedStopForUpload}
                      onChange={setSelectedStopForUpload}
                      placeholder="Search for a stop..."
                      required
                      emptyMessage="No stops available. Upload routes for today to see stops."
                    />
                    {stops.length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        No stops available. Upload routes for today to see stops.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Category
                  </label>
                  <select
                    name="type"
                    value={selectedDocumentType}
                    onChange={(e) => setSelectedDocumentType(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select category...</option>
                    {documentTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice-specific fields for stop documents */}
                {uploadType === 'stop' && selectedDocumentType === 'INVOICE' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-yellow-800">Invoice Information (Recommended)</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invoice Number <span className="text-yellow-600">(Recommended)</span>
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="Enter invoice number..."
                        className="w-full border border-yellow-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Amount <span className="text-yellow-600">(Recommended)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={invoiceAmount}
                        onChange={(e) => setInvoiceAmount(e.target.value)}
                        placeholder="Enter total amount..."
                        className="w-full border border-yellow-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                      />
                    </div>
                    <p className="text-xs text-yellow-700">
                      Adding invoice number and amount helps with tracking and prevents upload warnings.
                    </p>
                  </div>
                )}

                {/* Credit Memo-specific fields for stop documents */}
                {uploadType === 'stop' && selectedDocumentType === 'CREDIT_MEMO' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium text-purple-800">Credit Memo Information (Recommended)</span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Credit Memo Number <span className="text-purple-600">(Recommended)</span>
                      </label>
                      <input
                        type="text"
                        value={creditMemoNumber}
                        onChange={(e) => setCreditMemoNumber(e.target.value)}
                        placeholder="Enter credit memo number..."
                        className="w-full border border-purple-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Credit Amount <span className="text-purple-600">(Recommended)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={creditMemoAmount}
                        onChange={(e) => setCreditMemoAmount(e.target.value)}
                        placeholder="Enter credit amount..."
                        className="w-full border border-purple-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <p className="text-xs text-purple-700">
                      Adding credit memo number and amount helps with tracking and prevents upload warnings.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Enter document title..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Enter document description..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File
                  </label>
                  <input
                    type="file"
                    name="file"
                    required
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 10MB)
                  </p>
                </div>

                {/* Invoice Validation Alert */}
                {showValidationAlert && validationResult && (
                  <InvoiceValidationAlert
                    validationResult={validationResult}
                    onConfirm={handleValidationConfirm}
                    onCancel={handleValidationCancel}
                    showActions={needsUserConfirmation(validationResult)}
                    className="mt-4"
                  />
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Upload Document
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}



      {/* Stop Documents Modal */}
      {showStopDetailsModal && selectedStopForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Stop Documents</h3>
                <button
                  onClick={() => setShowStopDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Stop Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div><strong>Route:</strong> {selectedStopForDetails.route.routeNumber}</div>
                  <div><strong>Stop:</strong> {selectedStopForDetails.sequence} - {selectedStopForDetails.customerNameFromUpload}</div>
                  <div><strong>Customer:</strong> {selectedStopForDetails.customer.name}</div>
                  <div><strong>Driver:</strong> {selectedStopForDetails.driverNameFromUpload || selectedStopForDetails.route.driver?.fullName || selectedStopForDetails.route.driver?.username || 'Unassigned'}</div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Customer Documents */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Customer Documents
                    <span className="ml-2 text-sm text-gray-500">(Available for all deliveries to this customer)</span>
                  </h4>
                  <div className="border border-gray-200 rounded-lg">
                    {selectedStopForDetails.customer.documents && selectedStopForDetails.customer.documents.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {selectedStopForDetails.customer.documents.map((doc: Document) => (
                          <div key={doc.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{doc.title}</p>
                                <p className="text-sm text-gray-500">{doc.type.replace('_', ' ')} • {doc.fileName}</p>
                                <p className="text-xs text-gray-400 mt-1 flex items-center">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Uploaded {formatDate(doc.uploadedAt)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleViewDocument(doc)}
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex-shrink-0 ml-4"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        <p>No customer documents available</p>
                        <p className="text-sm">Upload customer documents to make them available for all deliveries</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stop-Specific Documents */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Stop-Specific Documents
                    <span className="ml-2 text-sm text-gray-500">(Only for this delivery stop)</span>
                  </h4>
                  <div className="border border-gray-200 rounded-lg">
                    {selectedStopForDetails.stopDocuments?.length > 0 ? (
                      <div className="divide-y divide-gray-200">
                        {selectedStopForDetails.stopDocuments.map(stopDoc => (
                          <div key={stopDoc.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{stopDoc.document.title}</p>
                                <p className="text-sm text-gray-500">{stopDoc.document.type.replace('_', ' ')} • {stopDoc.document.fileName}</p>
                                <p className="text-xs text-gray-400 mt-1 flex items-center">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Uploaded {formatDate(stopDoc.document.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                                <button
                                  onClick={() => handleViewDocument(stopDoc.document)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  View
                                </button>
                                <button
                                  onClick={() => {
                                    setDocumentToDelete(stopDoc.document.id);
                                    setShowDeleteConfirm(true);
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        <p>No stop-specific documents</p>
                        <p className="text-sm">Upload stop-specific documents for special delivery requirements</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowStopDetailsModal(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Document Modal */}
      {showEditModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Document</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title
                  </label>
                  <input
                    type="text"
                    name="title"
                    defaultValue={selectedDocument.title}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={selectedDocument.description || ''}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Category
                  </label>
                  <select
                    name="type"
                    defaultValue={selectedDocument.type}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {documentTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="isActive"
                    defaultValue={selectedDocument.isActive ? 'true' : 'false'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Update Document
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Delete Document</h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-gray-600">
                  Are you sure you want to delete the document &quot;{selectedDocument.title}&quot;?
                </p>
                <p className="text-sm text-red-600 mt-2">
                  This action cannot be undone. The document will be permanently removed from the system.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Delete Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stop Document Delete Confirmation Modal */}
      {showDeleteConfirm && documentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Delete Stop Document</h3>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-600">
                  Are you sure you want to delete this stop-specific document?
                  This action cannot be undone. The document will be permanently removed from the system.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDocumentToDelete(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (documentToDelete) {
                      handleDeleteStopDocument(documentToDelete);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Delete Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


