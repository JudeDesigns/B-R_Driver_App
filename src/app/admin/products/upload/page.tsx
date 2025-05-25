"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UploadResult {
  message: string;
  productsAdded: number;
  productsUpdated: number;
  productsFailed: number;
  totalProcessed: number;
  warnings?: string[];
}

export default function ProductUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check authentication
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      router.push("/login");
    } else {
      setToken(storedToken);
    }
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a CSV or Excel file to upload");
      return;
    }

    if (!token) {
      setError("You must be logged in to upload products");
      return;
    }

    // Check file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "xlsx" && fileExtension !== "xls" && fileExtension !== "csv") {
      setError("Please upload a valid file (.xlsx, .xls, or .csv)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            (data.errors && data.errors.length > 0
              ? data.errors.join("; ")
              : "Failed to upload products")
        );
      }

      setSuccess(true);
      setResult(data);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during upload";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-black">Upload Products</h1>
        <Link
          href="/admin/products"
          className="text-primary-blue hover:text-blue-700 transition duration-200 font-medium"
        >
          &larr; Back to Products
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-mono-200">
          <h2 className="text-lg font-medium text-mono-800">CSV/Excel Upload</h2>
        </div>
        <div className="p-6">
          {success && result ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-green-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      {result.message}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Total Processed</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {result.totalProcessed}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Added</p>
                  <p className="text-2xl font-bold text-green-600">
                    {result.productsAdded}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Updated</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {result.productsUpdated}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {result.productsFailed}
                  </p>
                </div>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">
                    Warnings
                  </h3>
                  <ul className="list-disc pl-5 text-sm text-yellow-700 space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => {
                    setFile(null);
                    setSuccess(false);
                    setResult(null);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded transition duration-200"
                >
                  Upload Another File
                </button>
                <Link
                  href="/admin/products"
                  className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded transition duration-200"
                >
                  Go to Products
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-mono-800 text-sm font-medium mb-2">
                  Upload CSV or Excel File
                </label>
                <div className="border-2 border-dashed border-mono-300 hover:border-primary-blue rounded-lg p-8 text-center transition-colors duration-200">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="flex flex-col items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-primary-green mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-mono-800 font-medium">
                          {file.name}
                        </span>
                        <span className="text-mono-500 text-sm mt-1">
                          Click to change file
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-10 w-10 text-mono-400 mb-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <span className="text-mono-800 font-medium">
                          Drag and drop your file here or click to browse
                        </span>
                        <span className="text-mono-500 text-sm mt-1">
                          Supports .xlsx, .xls, and .csv files
                        </span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div className="bg-primary-blue bg-opacity-5 p-5 rounded-lg mb-6">
                <div className="flex items-start">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-primary-blue mr-2 mt-0.5"
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
                  <div>
                    <h3 className="text-sm font-medium text-primary-blue mb-2">
                      Important Notes
                    </h3>
                    <ul className="text-sm text-mono-700 space-y-2 list-disc pl-5">
                      <li>
                        Your file should have columns for: Product Name, SKU, Unit, and Description.
                      </li>
                      <li>
                        If a product with the same SKU already exists, it will be updated.
                      </li>
                      <li>
                        The first row should contain column headers.
                      </li>
                      <li>
                        Rows with missing essential data (like Product Name or SKU) will be skipped.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="px-6 py-2 bg-black hover:bg-gray-800 text-white rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Uploading...
                    </div>
                  ) : (
                    "Upload Products"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
