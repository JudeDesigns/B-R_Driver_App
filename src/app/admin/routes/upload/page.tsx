"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RouteUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select an Excel file to upload");
      return;
    }

    // Check file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "xlsx" && fileExtension !== "xls") {
      setError("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/routes/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to upload route");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin");
      }, 2000);
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
        <h1 className="text-2xl font-bold text-gray-800">Upload Route</h1>
        <button
          onClick={() => router.back()}
          className="text-blue-500 hover:text-blue-600 transition duration-200"
        >
          &larr; Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700">Excel Upload</h2>
        </div>
        <div className="p-6">
          {success ? (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              Route uploaded successfully! Redirecting to dashboard...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Upload Excel File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-blue-500 hover:text-blue-600"
                  >
                    {file ? (
                      <span className="text-gray-700">{file.name}</span>
                    ) : (
                      <>
                        <span className="text-blue-500">Click to upload</span>{" "}
                        or drag and drop
                      </>
                    )}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Only Excel files (.xlsx, .xls) are supported
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Column Mapping
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  The system will map the following columns from your Excel
                  file:
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>Column C → Assigned Driver</li>
                  <li>Column F → Customer Name</li>
                  <li>Column P → Web Order/Orders #</li>
                  <li>Column AC → Notes for Driver</li>
                  <li>Column AI → QuickBooks Invoice #</li>
                  <li>Column AD → COD Account Flag</li>
                  <li>Columns AK-AN → Payment Method Flags</li>
                  <li>Column AQ → Return Flag</li>
                  <li>Column AR → Driver Remark</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading || !file}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Uploading..." : "Upload Route"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
