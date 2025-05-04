"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EndRoutePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // In Phase 1, we're just creating a placeholder
    // This will be fully implemented in Phase 5

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      router.push("/driver");
    }, 1000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-20">
      <h1 className="text-2xl font-medium text-black text-center mt-6">
        End of Route
      </h1>

      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="p-6">
          <div className="border-l-4 border-gray-300 pl-4 py-2 mb-6">
            <p className="text-sm text-gray-600">
              This is a placeholder for the end-of-route page. Full
              functionality will be implemented in Phase 5.
            </p>
          </div>

          <div className="space-y-6 mb-8">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                Route Information
              </h3>
              <div className="border border-gray-200 rounded p-4">
                <p className="text-sm text-gray-600">No active route found.</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                Returns Summary
              </h3>
              <div className="border border-gray-200 rounded p-4">
                <p className="text-sm text-gray-600">
                  No returns logged for this route.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Return Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Warehouse Location
                    </label>
                    <select
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none"
                      disabled
                    >
                      <option>Select location</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Vendor Credit # (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none"
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <Link
                  href="/driver"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded text-center text-gray-800 hover:bg-gray-50 transition duration-200"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Submitting..." : "Complete Route"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
