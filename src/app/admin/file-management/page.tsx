"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface FileRecord {
  id: string;
  originalName: string;
  storedName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: {
    id: string;
    name: string;
    description: string;
  } | null;
  uploader: {
    id: string;
    username: string;
    fullName: string;
  };
  thumbnails: Array<{
    id: string;
    size: string;
    filePath: string;
    width: number;
    height: number;
  }>;
  metadata: Record<string, any>;
  createdAt: string;
}

export default function FileManagementPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const router = useRouter();

  const categories = [
    { value: "all", label: "All Files" },
    { value: "delivery-photos", label: "Delivery Photos" },
    { value: "documents", label: "Documents" },
    { value: "pdfs", label: "PDFs" },
    { value: "safety-checks", label: "Safety Checks" },
  ];

  useEffect(() => {
    // Check Super Admin access
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("userRole");

    if (!token || role !== "SUPER_ADMIN") {
      router.push("/admin");
      return;
    }

    setUserRole(role);
    fetchFiles();
  }, [selectedCategory, showArchived, router]);

  const handleViewFile = (file: FileRecord & { source?: string }) => {
    if (file.source === 'document-management') {
      // Documents are stored in public/uploads/documents and have direct paths
      window.open(file.filePath, '_blank');
    } else {
      // File management files are in uploads/ directory
      const filePath = `/uploads/${file.filePath}`;
      window.open(filePath, '_blank');
    }
  };

  const handleDeleteFile = (file: FileRecord & { source?: string }) => {
    setSelectedFile(file);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedFile) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required");
        return;
      }

      let response;
      const fileWithSource = selectedFile as FileRecord & { source?: string };

      if (fileWithSource.source === 'document-management') {
        // Delete document via documents API
        const docId = selectedFile.id.replace('doc_', '');
        response = await fetch(`/api/admin/documents/${docId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } else {
        // Delete file via files API
        response = await fetch(`/api/files/upload?id=${selectedFile.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      // Refresh the file list
      fetchFiles();
      setDeleteModalOpen(false);
      setSelectedFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Fetch both file management files and documents
      const [filesResponse, documentsResponse] = await Promise.all([
        // File management files
        fetch("/api/files/upload?" + new URLSearchParams({
          ...(selectedCategory !== "all" && { category: selectedCategory }),
          archived: showArchived.toString(),
          limit: "50",
        }), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        // Documents from document management
        fetch("/api/admin/documents", {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      const filesData = filesResponse.ok ? await filesResponse.json() : { files: [] };
      const documentsData = documentsResponse.ok ? await documentsResponse.json() : [];

      console.log('Debug - Files data:', filesData);
      console.log('Debug - Documents data:', documentsData);

      // Convert documents to file format for display
      const convertedDocuments = (documentsData || []).map((doc: any) => {
        console.log('Converting document:', doc);
        return {
          id: `doc_${doc.id}`,
          originalName: doc.fileName,
          storedName: doc.fileName,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          category: { name: getDocumentCategory(doc.type) },
          uploadedBy: doc.uploadedBy,
          uploader: doc.uploader,
          createdAt: doc.createdAt,
          isArchived: false,
          source: 'document-management'
        };
      });

      console.log('Debug - Converted documents:', convertedDocuments);

      // Combine and filter files
      const allFiles = [
        ...(filesData.files || []).map((f: any) => ({ ...f, source: 'file-management' })),
        ...convertedDocuments
      ];

      console.log('Debug - All files combined:', allFiles);

      // Apply category filter
      const filteredFiles = selectedCategory === "all"
        ? allFiles
        : allFiles.filter(file => file.category?.name === selectedCategory);

      console.log('Debug - Filtered files:', filteredFiles);
      console.log('Debug - Selected category:', selectedCategory);

      setFiles(filteredFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getDocumentCategory = (docType: string): string => {
    const mapping: Record<string, string> = {
      'INVOICE': 'invoices',
      'CREDIT_MEMO': 'credit-memos',
      'DELIVERY_RECEIPT': 'statements',
      'RETURN_FORM': 'documents',
      'OTHER': 'documents',
    };
    return mapping[docType] || 'documents';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
    return "📁";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">File Management System</h1>
          <p className="mt-2 text-gray-600">
            System administration for all files, documents, and images (Super Admin Only)
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="showArchived"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="showArchived" className="ml-2 text-sm text-gray-700">
                Show archived files
              </label>
            </div>

            <div className="ml-auto text-sm text-gray-500">
              Files are uploaded through Document Management
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Files Grid */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Files ({files.length})
            </h2>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📁</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-500">
                {showArchived ? "No archived files" : "No active files"} in the selected category.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Source
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">
                            {getFileIcon(file.mimeType)}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {file.originalName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {file.mimeType}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {file.category?.name || "Uncategorized"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          (file as any).source === 'document-management'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {(file as any).source === 'document-management' ? 'Documents' : 'Files'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatFileSize(file.fileSize)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {file.uploader.fullName || file.uploader.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg font-medium text-gray-900">Delete File</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete "{selectedFile?.originalName}"? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
