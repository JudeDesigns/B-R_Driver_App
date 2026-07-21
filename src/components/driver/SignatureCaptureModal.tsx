"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignatureCaptureModalProps {
  isOpen: boolean;
  documentTitle: string;
  onCancel: () => void;
  onSubmit: (signatureDataUrl: string) => Promise<void> | void;
  submitting?: boolean;
}

export default function SignatureCaptureModal({
  isOpen,
  documentTitle,
  onCancel,
  onSubmit,
  submitting = false,
}: SignatureCaptureModalProps) {
  const sigRef = useRef<SignatureCanvas>(null);
  const [error, setError] = useState("");

  if (!isOpen) {
    return null;
  }

  const handleClear = () => {
    sigRef.current?.clear();
    setError("");
  };

  const handleSubmit = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setError("Please provide a signature before submitting");
      return;
    }

    let dataUrl: string;
    try {
      dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    } catch {
      dataUrl = sigRef.current.toDataURL("image/png");
    }

    setError("");
    await onSubmit(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Sign: {documentTitle}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Please sign in the box below using your finger or mouse.
          </p>

          <div className="border-2 border-gray-300 rounded-lg overflow-hidden mb-3">
            <SignatureCanvas
              ref={sigRef}
              canvasProps={{
                className: "w-full touch-manipulation",
                style: { width: "100%", height: "200px" },
              }}
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={handleClear}
              disabled={submitting}
              className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50 touch-manipulation tap-target"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-50 touch-manipulation tap-target"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation tap-target"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-4 w-4 mr-2"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing...
                </span>
              ) : (
                "Submit Signature"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
