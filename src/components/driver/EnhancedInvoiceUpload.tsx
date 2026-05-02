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
  existingPdfUrl?: string | null;
}

export default function EnhancedInvoiceUpload({
  stopId,
  onUploadSuccess,
  onUploadComplete,
  existingPdfUrl,
}: EnhancedInvoiceUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // Track which image is being replaced (if any)
  const [replacingImageId, setReplacingImageId] = useState<string | null>(null);
  // Gallery picker — supports multi-select.
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Camera input — single shot with `capture="environment"` so iOS Safari and
  // Android Chrome both open the rear camera directly instead of showing an
  // action sheet. `multiple` is intentionally omitted; some mobile browsers
  // ignore `capture` when `multiple` is also present.
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  // Function to compress image on client side
  const compressImage = async (file: File, maxSizeKB: number = 800): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions (max 1600px width)
        let { width, height } = img;
        const maxWidth = 1600;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        // Start with quality 0.8 and reduce if needed
        let quality = 0.8;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedSizeKB = blob.size / 1024;

              if (compressedSizeKB <= maxSizeKB || quality <= 0.3) {
                // Create new file with compressed data
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });

                console.log(`📱 Client compression: ${file.name} ${(file.size/1024).toFixed(1)}KB → ${compressedSizeKB.toFixed(1)}KB`);
                resolve(compressedFile);
              } else {
                // Try with lower quality
                quality -= 0.1;
                tryCompress();
              }
            } else {
              resolve(file); // Fallback to original
            }
          }, 'image/jpeg', quality);
        };

        tryCompress();
      };

      img.onerror = () => resolve(file); // Fallback to original
      img.src = URL.createObjectURL(file);
    });
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

    // Check if we should compress images
    const totalImages = images.length + validFiles.length;
    const shouldCompress = totalImages >= 10 || validFiles.some(f => f.size > 1000000); // 10+ images or files > 1MB

    if (shouldCompress) {
      setError('Compressing images for better performance...');
    }

    // Compress images if needed
    const processedFiles = shouldCompress
      ? await Promise.all(validFiles.map(file => compressImage(file)))
      : validFiles;

    // Create preview objects for new files
    const newImages: UploadedImage[] = processedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      uploaded: false,
    }));

    // Handle replacement if active
    if (replacingImageId && newImages.length > 0) {
      setImages(prev => prev.map(img =>
        img.id === replacingImageId
          ? { ...newImages[0], id: replacingImageId } // Keep original ID to avoid jumpiness
          : img
      ));
      setReplacingImageId(null);
    } else {
      // Add to existing images (or replace if first selection)
      setImages(prev => images.length === 0 ? newImages : [...prev, ...newImages]);
    }

    setError('');

    if (shouldCompress) {
      console.log(`📱 Client-side compression completed for ${processedFiles.length} images`);
    }

    // Reset both inputs so the same file/photo can be re-selected.
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
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

  // Show confirmation dialog before upload (only if there are existing images)
  const handleUploadClick = () => {
    if (images.length === 0) {
      setError('Please select at least one image');
      return;
    }

    // Only show confirmation dialog if there are existing images
    if (existingPdfUrl || pdfUrl) {
      setShowConfirmDialog(true);
    } else {
      // No existing images, upload directly
      handleUploadAll();
    }
  };

  // Upload all images and generate PDF (called after confirmation)
  const handleUploadAll = async () => {
    // Close confirmation dialog
    setShowConfirmDialog(false);

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

        <div className="mb-4">
          {/* Hidden gallery picker — multi-select, no capture. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Hidden camera input — capture="environment" forces the rear
              camera on iOS Safari and Android Chrome. No `multiple` here:
              several mobile browsers ignore `capture` when both are set. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {images.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploading}
                className="border-2 border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 rounded-lg p-6 text-center transition-colors disabled:opacity-50"
              >
                <div className="space-y-2">
                  <svg className="mx-auto h-10 w-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-blue-700 font-semibold">Take Photo</div>
                  <p className="text-xs text-blue-600">Open camera</p>
                </div>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg p-6 text-center transition-colors disabled:opacity-50"
              >
                <div className="space-y-2">
                  <svg className="mx-auto h-10 w-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-gray-700 font-semibold">Choose from Gallery</div>
                  <p className="text-xs text-gray-500">Pick existing photos</p>
                </div>
              </button>
            </div>
          ) : null}
        </div>

        {/* Add More Images — same two-option pattern */}
        {images.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Take Photo
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add from Gallery
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
                    onClick={() => {
                      setReplacingImageId(image.id);
                      cameraInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform"
                    title="Replace with camera"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setReplacingImageId(image.id);
                      fileInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="bg-gray-600 text-white p-3 rounded-full hover:bg-gray-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform"
                    title="Replace from gallery"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                    onClick={() => {
                      setReplacingImageId(image.id);
                      cameraInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg"
                    title="Replace with camera"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setReplacingImageId(image.id);
                      fileInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="bg-gray-600 text-white p-2 rounded-full hover:bg-gray-700 disabled:opacity-50 shadow-lg"
                    title="Replace from gallery"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
          onClick={handleUploadClick}
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 mb-20 sm:mb-0 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Warning: Images Will Be Replaced
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p className="font-semibold text-yellow-700">
                    Uploading new images will replace ALL previously uploaded images for this delivery.
                  </p>
                  <p>
                    Please ensure you are uploading <strong>ALL required images at once</strong>, including any previously uploaded images you want to keep.
                  </p>
                  <p>
                    If you only upload a single missing image, all other images will be lost.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadAll}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200"
              >
                Continue Upload
              </button>
            </div>
          </div>
        </div>
      )}

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
