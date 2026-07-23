'use client';

import React, { useState, useRef } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';

type UploadCategory = 'financial' | 'delivery';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  uploaded: boolean;
  category: UploadCategory;
}

interface EnhancedInvoiceUploadProps {
  stopId: string;
  onUploadSuccess: (pdfUrl: string) => void;
  onUploadComplete: () => void;
  existingPdfUrl?: string | null;
  // URLs of images already uploaded (and included in the last generated
  // PDF, if any) for this stop, from a previous session or a previous page
  // load. Used only to accurately reflect what's already on the server —
  // new uploads are always merged with these server-side, never replacing
  // them.
  existingImageUrls?: string[] | null;
}

// Category is embedded in the filename as `_fin_` or `_dlv_` right before
// `img<N>.jpg`. Images from before this tagging existed have neither tag.
function categorizeExistingUrl(url: string): UploadCategory | 'unknown' {
  if (/_dlv_img\d+\.jpg$/.test(url)) return 'delivery';
  if (/_fin_img\d+\.jpg$/.test(url)) return 'financial';
  return 'unknown';
}

const SECTION_CONFIG: Record<
  UploadCategory,
  {
    title: string;
    instructions: string[];
    warning: string;
    accentBorder: string;
  }
> = {
  financial: {
    title: 'Financial Documents',
    instructions: [
      'Customer or vendor invoices',
      'Checks and payment receipts',
      'Statements',
      'Credit memos',
      'Gas and diesel receipts',
    ],
    warning: 'You have not uploaded any financial documents.',
    accentBorder: 'border-blue-500',
  },
  delivery: {
    title: 'Proof of Delivery and Execution',
    instructions: [
      'All four sides of each pallet',
      'Dollies loaded with products',
      'Product labels and weights',
      'Fuel pumps and related fueling documentation',
    ],
    warning: 'You have not uploaded any proof-of-delivery or execution images.',
    accentBorder: 'border-gray-500',
  },
};

export default function EnhancedInvoiceUpload({
  stopId,
  onUploadSuccess,
  onUploadComplete,
  existingPdfUrl,
  existingImageUrls,
}: EnhancedInvoiceUploadProps) {
  const [financialImages, setFinancialImages] = useState<UploadedImage[]>([]);
  const [deliveryImages, setDeliveryImages] = useState<UploadedImage[]>([]);
  const [financialSkipped, setFinancialSkipped] = useState(false);
  const [deliverySkipped, setDeliverySkipped] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  // Track which image is being replaced (if any), per category
  const [replacingImageId, setReplacingImageId] = useState<{ id: string; category: UploadCategory } | null>(null);

  // Images already on the server (from a previous session, possibly with a
  // PDF already generated). Split by category from the filename tag; any
  // legacy untagged images (uploaded before category tagging existed) are
  // counted under "financial" as a reasonable default.
  const existingByCategory = React.useMemo(() => {
    const urls = existingImageUrls || [];
    const result: Record<UploadCategory, string[]> = { financial: [], delivery: [] };
    for (const url of urls) {
      const category = categorizeExistingUrl(url);
      result[category === 'delivery' ? 'delivery' : 'financial'].push(url);
    }
    return result;
  }, [existingImageUrls]);

  const getExistingCount = (category: UploadCategory) => existingByCategory[category].length;

  // Gallery/camera inputs — one pair per category so each box's "Take Photo"
  // / "From Gallery" buttons only ever populate that box.
  const financialFileInputRef = useRef<HTMLInputElement>(null);
  const financialCameraInputRef = useRef<HTMLInputElement>(null);
  const deliveryFileInputRef = useRef<HTMLInputElement>(null);
  const deliveryCameraInputRef = useRef<HTMLInputElement>(null);

  // Note: we intentionally do NOT pre-clear server-side files here. The
  // upload route writes new files under a fresh sessionId, so they never
  // collide with the previous session on disk. Old files are cleaned up
  // atomically by the upload route AFTER the new DB write succeeds. This
  // prevents the previous race where a failed/abandoned re-upload would
  // wipe the prior session's files and leave the Stop pointing at 404s.

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

  const getImages = (category: UploadCategory) =>
    category === 'financial' ? financialImages : deliveryImages;
  const setImagesForCategory = (category: UploadCategory) =>
    category === 'financial' ? setFinancialImages : setDeliveryImages;

  // Handle file selection (multiple files) for a given category box
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    category: UploadCategory
  ) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    // Validate file types
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      setError('Only image files are allowed');
      return;
    }

    const images = getImages(category);
    const setImages = setImagesForCategory(category);

    // Reset shared preview/PDF state for a fresh selection. Server-side
    // files from the previous session are NOT touched here — the upload
    // route swaps and cleans atomically after the new DB write succeeds.
    if (financialImages.length === 0 && deliveryImages.length === 0) {
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
      category,
    }));

    // Handle replacement if active for this category
    if (replacingImageId && replacingImageId.category === category && newImages.length > 0) {
      setImages(prev => prev.map(img =>
        img.id === replacingImageId.id
          ? { ...newImages[0], id: replacingImageId.id } // Keep original ID to avoid jumpiness
          : img
      ));
      setReplacingImageId(null);
    } else {
      // Add to existing images (or replace if first selection)
      setImages(prev => images.length === 0 ? newImages : [...prev, ...newImages]);
    }

    // Uploading any images to a section clears its "skip" flag.
    if (category === 'financial') {
      setFinancialSkipped(false);
    } else {
      setDeliverySkipped(false);
    }

    setError('');

    if (shouldCompress) {
      console.log(`📱 Client-side compression completed for ${processedFiles.length} images`);
    }

    // Reset both inputs for this category so the same file/photo can be re-selected.
    const fileInputRef = category === 'financial' ? financialFileInputRef : deliveryFileInputRef;
    const cameraInputRef = category === 'financial' ? financialCameraInputRef : deliveryCameraInputRef;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Remove an image
  const removeImage = (id: string, category: UploadCategory) => {
    const setImages = setImagesForCategory(category);
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

  const allImages = [...financialImages, ...deliveryImages];

  // Show confirmation dialog before upload (only if there are existing images)
  const handleUploadClick = () => {
    if (allImages.length === 0) {
      setError('Please select at least one image, or skip a section if it does not apply');
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

  // Upload all images (financial first, then delivery) and generate PDF
  // (called after confirmation). This preserves the existing combined
  // upload/PDF/email pipeline exactly as before — the only addition is a
  // `category` tag sent per image, which is used solely for admin-side
  // financial-only reporting and does not affect this flow.
  const handleUploadAll = async () => {
    // Close confirmation dialog
    setShowConfirmDialog(false);

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    const images = allImages;

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
        formData.append('category', image.category); // Financial vs delivery tag

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
        const setImages = setImagesForCategory(image.category);
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
  const allImagesReady = allImages.length > 0 && allImages.every(img => img.file);

  const renderUploadBox = (category: UploadCategory) => {
    const config = SECTION_CONFIG[category];
    const images = getImages(category);
    const existingCount = getExistingCount(category);
    const hasAnyImages = images.length > 0 || existingCount > 0;
    const skipped = category === 'financial' ? financialSkipped : deliverySkipped;
    const setSkipped = category === 'financial' ? setFinancialSkipped : setDeliverySkipped;
    const fileInputRef = category === 'financial' ? financialFileInputRef : deliveryFileInputRef;
    const cameraInputRef = category === 'financial' ? financialCameraInputRef : deliveryCameraInputRef;

    return (
      <div className={`bg-white rounded-lg shadow-md border-l-4 ${config.accentBorder} p-6`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{config.title}</h3>

        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-sm font-medium text-gray-700 mb-1">
            {category === 'financial'
              ? 'Upload the following when applicable:'
              : 'Upload clear photos of the following when applicable:'}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
            {config.instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        {/* Hidden gallery picker — multi-select, no capture. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e, category)}
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
          onChange={(e) => handleFileSelect(e, category)}
          className="hidden"
        />

        {skipped ? (
          /* Section skipped: hide the upload controls, keep only the
             checkbox visible so the driver can un-skip if needed. */
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={skipped}
              onChange={(e) => setSkipped(e.target.checked)}
              disabled={isUploading}
            />
            Skip this section (not applicable for this stop)
          </label>
        ) : (
          <>
            {!hasAnyImages && (
              <div className="mb-3 bg-red-50 border border-red-300 text-red-700 text-sm font-medium px-3 py-2 rounded-lg">
                {config.warning}
              </div>
            )}

            {existingCount > 0 && images.length === 0 && (
              <div className="mb-3 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-3 py-2 rounded-lg">
                {existingCount} image{existingCount !== 1 ? 's' : ''} already uploaded for this section. You can add more below if needed — new images are added to, not replacing, what's already uploaded.
              </div>
            )}

            {images.length === 0 ? (
              <div className="space-y-3">
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
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={skipped}
                    onChange={(e) => setSkipped(e.target.checked)}
                    disabled={isUploading}
                  />
                  Skip this section (not applicable for this stop)
                </label>
              </div>
            ) : (
          <>
            {/* Add More Images — same two-option pattern */}
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

            {/* Image Preview Grid */}
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
                        alt="Upload preview"
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
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center space-x-3">
                      <button
                        onClick={() => {
                          setReplacingImageId({ id: image.id, category });
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
                          setReplacingImageId({ id: image.id, category });
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
                        onClick={() => removeImage(image.id, category)}
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
                          setReplacingImageId({ id: image.id, category });
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
                          setReplacingImageId({ id: image.id, category });
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
                        onClick={() => removeImage(image.id, category)}
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
          </>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderUploadBox('financial')}
      {renderUploadBox('delivery')}

      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-white rounded-lg shadow-md p-6">
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
          `Upload ${allImages.length} Image${allImages.length !== 1 ? 's' : ''} & Generate PDF`
        )}
      </button>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 mb-20 sm:mb-0 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Regenerate PDF?
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>
                    A PDF has already been generated for this delivery. Uploading these new images will add them to the ones already uploaded and regenerate the PDF with everything combined.
                  </p>
                  <p>
                    No previously uploaded images will be lost.
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
