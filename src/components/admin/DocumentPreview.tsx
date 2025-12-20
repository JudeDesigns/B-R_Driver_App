'use client';

import React from 'react';

interface Document {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  uploader: {
    id: string;
    username: string;
    fullName: string | null;
  };
}

interface StopDocument {
  id: string;
  document: Document;
  isPrinted: boolean;
  printedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocumentPreviewProps {
  customerDocuments: Document[];
  stopDocuments: StopDocument[];
  customerName: string;
}

const getDocumentTypeIcon = (type: string) => {
  switch (type) {
    case 'INVOICE':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      );
    case 'CREDIT_MEMO':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
        </svg>
      );
    case 'DELIVERY_RECEIPT':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
        </svg>
      );
    case 'RETURN_FORM':
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
  }
};

const getDocumentTypeLabel = (type: string) => {
  switch (type) {
    case 'INVOICE':
      return 'Invoice';
    case 'CREDIT_MEMO':
      return 'Credit Memo';
    case 'DELIVERY_RECEIPT':
      return 'Delivery Receipt';
    case 'RETURN_FORM':
      return 'Return Form';
    default:
      return 'Document';
  }
};

const getDocumentTypeColor = (type: string) => {
  switch (type) {
    case 'INVOICE':
      return 'text-blue-600 bg-blue-100';
    case 'CREDIT_MEMO':
      return 'text-red-600 bg-red-100';
    case 'DELIVERY_RECEIPT':
      return 'text-green-600 bg-green-100';
    case 'RETURN_FORM':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DocumentPreview({ customerDocuments, stopDocuments, customerName }: DocumentPreviewProps) {
  const handleViewDocument = (document: Document) => {
    window.open(document.filePath, '_blank');
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm6 6a1 1 0 11-2 0v-2a1 1 0 00-1-1H6a1 1 0 100 2h1v2a1 1 0 102 0V9h1a1 1 0 001-1z" clipRule="evenodd" />
          </svg>
          Document Preview
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Documents available for this stop and customer
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Customer-Level Documents */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            Customer Documents ({customerName})
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
              {customerDocuments.length}
            </span>
          </h4>
          
          {customerDocuments.length === 0 ? (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No customer-level documents</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {customerDocuments.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`p-2 rounded-lg ${getDocumentTypeColor(doc.type)}`}>
                        {getDocumentTypeIcon(doc.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-gray-900 truncate">{doc.title}</h5>
                        {doc.description && (
                          <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded-full ${getDocumentTypeColor(doc.type)}`}>
                            {getDocumentTypeLabel(doc.type)}
                          </span>
                          <span>{doc.fileName}</span>
                          <span>{formatFileSize(doc.fileSize)}</span>
                          <span>Uploaded: {formatDate(doc.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDocument(doc)}
                      className="ml-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stop-Specific Documents */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Stop-Specific Documents
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              {stopDocuments.length}
            </span>
          </h4>
          
          {stopDocuments.length === 0 ? (
            <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No stop-specific documents</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {stopDocuments.map((stopDoc) => (
                <div key={stopDoc.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`p-2 rounded-lg ${getDocumentTypeColor(stopDoc.document.type)}`}>
                        {getDocumentTypeIcon(stopDoc.document.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-gray-900 truncate">{stopDoc.document.title}</h5>
                        {stopDoc.document.description && (
                          <p className="text-sm text-gray-600 mt-1">{stopDoc.document.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span className={`px-2 py-1 rounded-full ${getDocumentTypeColor(stopDoc.document.type)}`}>
                            {getDocumentTypeLabel(stopDoc.document.type)}
                          </span>
                          <span>{stopDoc.document.fileName}</span>
                          <span>{formatFileSize(stopDoc.document.fileSize)}</span>
                          <span>Uploaded: {formatDate(stopDoc.document.createdAt)}</span>
                          {stopDoc.isPrinted && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                              Printed
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewDocument(stopDoc.document)}
                      className="ml-3 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
