"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SafetyCheckPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // In Phase 1, we're just creating a placeholder
    // This will be fully implemented in Phase 6

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      router.push("/driver");
    }, 1000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-20">
      <h1 className="text-2xl font-medium text-black text-center mt-6">
        Safety Checklist
      </h1>

      <div className="border border-gray-200 rounded overflow-hidden">
        <div className="p-6">
          <div className="border-l-4 border-gray-300 pl-4 py-2 mb-6">
            <p className="text-sm text-gray-600">
              This is a placeholder for the safety checklist. Full functionality
              will be implemented in Phase 6.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6 mb-8">
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Vehicle & Fuel Check
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      MIL #1
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none"
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Fueling Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Diesel Amount
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Credit Card No.
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-200 rounded focus:outline-none"
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Photo/Video Upload
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      disabled
                    />
                    <label className="ml-3 block text-sm text-gray-600">
                      Upload photo of front lights/tail lights
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-black border-gray-300 rounded"
                      disabled
                    />
                    <label className="ml-3 block text-sm text-gray-600">
                      Upload photo of electricity box
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Checklist"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
