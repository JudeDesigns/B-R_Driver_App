"use client";

import { useState, useRef } from "react";

interface SafetyPhotoBoxProps {
    label: string;
    type: string;
    routeId: string;
    onUploadSuccess: (url: string) => void;
    required?: boolean;
    currentUrl?: string;
}

export default function SafetyPhotoBox({
    label,
    type,
    routeId,
    onUploadSuccess,
    required = false,
    currentUrl,
}: SafetyPhotoBoxProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset state
        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        formData.append("routeId", routeId);

        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");
            const response = await fetch("/api/driver/safety-check/upload", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) throw new Error("Upload failed");

            const data = await response.json();
            onUploadSuccess(data.url);
        } catch (err) {
            console.error("Upload error:", err);
            setError("Failed to upload. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    const triggerCapture = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <div className={`p-4 border-2 rounded-xl transition-all ${currentUrl ? "border-green-200 bg-green-50" : "border-dashed border-gray-300 bg-gray-50"
            }`}>
            <div className="flex flex-col items-center justify-center text-center space-y-3">
                <span className="text-sm font-semibold text-gray-700">
                    {label} {required && <span className="text-red-500">*</span>}
                </span>

                {currentUrl ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-green-300 shadow-sm">
                        <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
                        <button
                            onClick={triggerCapture}
                            className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-lg text-xs font-bold text-gray-800 hover:bg-white"
                        >
                            🔄 Replace
                        </button>
                        <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Uploaded
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={triggerCapture}
                        disabled={uploading}
                        className="w-full py-6 flex flex-col items-center justify-center space-y-2 text-gray-500 hover:text-black hover:bg-gray-100/50 rounded-lg transition-colors"
                    >
                        {uploading ? (
                            <>
                                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-medium">Uploading...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-3xl">📸</span>
                                <span className="text-sm font-medium">Tap to Take Photo</span>
                                <span className="text-[10px] text-gray-400 font-normal">Rear camera will be used</span>
                            </>
                        )}
                    </button>
                )}

                {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
        </div>
    );
}
