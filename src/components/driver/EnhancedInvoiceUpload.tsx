'use client';

import React, { useState, useRef } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  uploaded: boolean;
}

interface EnhancedInvoiceUploadProps {
  stopId: string;
  onUploadSuccess: (pdfUrl: string) => void;
  onUploadComplete: () => void;
}

export default function EnhancedInvoiceUpload({
  stopId,
  onUploadSuccess,
  onUploadComplete,
}: EnhancedInvoiceUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear existing images for this stop
  const clearExistingImages = async () => {
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
      const response = await fetch(`/api/driver/stops/${stopId}/clear-images`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('Failed to clear existing images');
      }
    } catch (error) {
      console.warn('Error clearing existing images:', error);
    }
  };

  // Handle file selection (multiple files)
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Validate file types
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      setError('Only image files are allowed');
      return;
    }

    // If this is the first selection (no existing images), clear everything
    if (images.length === 0) {
      await clearExistingImages();
      setPdfUrl('');
      setShowPreview(false);
      setSuccess('');
    }

    // Create preview objects for new files
    const newImages: UploadedImage[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      uploaded: false,
    }));

    // Add to existing images (or replace if first selection)
    setImages(prev => images.length === 0 ? newImages : [...prev, ...newImages]);
    setError('');

    // Reset file input to allow re-selection of same files
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove an image
  const removeImage = (id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      // Revoke object URL to prevent memory leaks
      const imageToRemove = prev.find(img => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return updated;
    });
  };

  // Replace an image
  const replaceImage = (id: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && file.type.startsWith('image/')) {
        setImages(prev => prev.map(img =>
          img.id === id
            ? { ...img, file, preview: URL.createObjectURL(file), uploaded: false }
            : img
        ));
      }
    };
    input.click();
  };

  // Upload all images and generate PDF
  const handleUploadAll = async () => {
    if (images.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';

      // Generate a unique session ID for this upload batch
      const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Upload images one by one
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const formData = new FormData();
        formData.append('file', image.file);
        formData.append('imageIndex', i.toString());
        formData.append('totalImages', images.length.toString());
        formData.append('sessionId', sessionId); // Add session ID for grouping

        const response = await fetch(`/api/driver/stops/${stopId}/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Upload failed');
        }

        const data = await response.json();

        // Update progress
        setUploadProgress(((i + 1) / images.length) * 100);

        // Mark image as uploaded
        setImages(prev => prev.map(img =>
          img.id === image.id ? { ...img, uploaded: true } : img
        ));

        // If this is the last image, get the PDF URL
        if (i === images.length - 1) {
          setPdfUrl(data.pdfUrl);
          setSuccess('All images uploaded successfully! PDF generated.');
          onUploadSuccess(data.pdfUrl);
        }
      }

      setShowPreview(true);
      // Don't auto-complete delivery - let driver manually complete when ready
      // onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Check if all images are ready for upload
  const allImagesReady = images.length > 0 && images.every(img => img.file);

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Upload Invoice Images
        </h3>

        {/* File Input */}
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors disabled:opacity-50"
          >
            <div className="space-y-2">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-gray-600">
                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
              </div>
              <p className="text-sm text-gray-500">PNG, JPG, JPEG up to 10MB each</p>
            </div>
          </button>
        </div>

        {/* Add More Images Button */}
        {images.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add More Images
            </button>
          </div>
        )}

        {/* Image Preview Grid */}
        {images.length > 0 && (
          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">
                Selected Images ({images.length})
              </h4>
              <p className="text-xs text-gray-500">
                Hover over images to see edit options
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-blue-300 transition-colors">
                    <img
                      src={image.preview}
                      alt="Invoice preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                {/* Image Status Indicator */}
                <div className="absolute top-2 right-2">
                  {image.uploaded ? (
                    <div className="bg-green-500 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : (
                    <div className="bg-yellow-500 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Image Actions - Enhanced visibility */}
                <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center space-x-3">
                  <button
                    onClick={() => replaceImage(image.id)}
                    disabled={isUploading}
                    className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform"
                    title="Replace image"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeImage(image.id)}
                    disabled={isUploading}
                    className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform"
                    title="Remove image"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Mobile-friendly action buttons (always visible on small screens) */}
                <div className="md:hidden absolute bottom-2 right-2 flex space-x-1">
                  <button
                    onClick={() => replaceImage(image.id)}
                    disabled={isUploading}
                    className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg"
                    title="Replace"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeImage(image.id)}
                    disabled={isUploading}
                    className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 disabled:opacity-50 shadow-lg"
                    title="Delete"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading images...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUploadAll}
          disabled={!allImagesReady || isUploading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner size="sm" />
              <span className="ml-2">Uploading & Generating PDF...</span>
            </div>
          ) : (
            `Upload ${images.length} Image${images.length !== 1 ? 's' : ''} & Generate PDF`
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* PDF Preview */}
      {showPreview && pdfUrl && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Generated PDF Preview
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <iframe
              src={pdfUrl}
              className="w-full h-96"
              title="Generated Invoice PDF"
            />
          </div>
          <div className="mt-4 flex space-x-3">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-center transition duration-200"
            >
              View Full PDF
            </a>
            <a
              href={pdfUrl}
              download
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg text-center transition duration-200"
            >
              Download PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
