"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Stop {
  id: string;
  sequence: number;
  customer: {
    name: string;
    address: string;
  };
  status: "PENDING" | "ON_THE_WAY" | "ARRIVED" | "COMPLETED";
  orderNumber?: string;
  qbInvoiceNumber?: string;
  initialDriverNotes?: string;
}

type Params = {
  id: string;
};

type Props = {
  params: Params;
};

export default function StopDetailPage({ params }: Props) {
  const [stop, setStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoiceImage, setInvoiceImage] = useState<File | null>(null);
  const [hasReturns, setHasReturns] = useState(false);
  const [driverNote, setDriverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Invoice, 2: Returns, 3: Notes
  const router = useRouter();

  useEffect(() => {
    // In a real implementation, this would fetch data from the API
    // For now, we'll just simulate loading with mock data
    const timer = setTimeout(() => {
      setLoading(false);
      // Mock data for demonstration
      setStop({
        id: params.id,
        sequence: parseInt(params.id),
        customer: {
          name: params.id === "1" ? "ABC Restaurant" : "XYZ Grocery",
          address:
            params.id === "1"
              ? "123 Main St, Anytown, USA"
              : "456 Oak Ave, Somewhere, USA",
        },
        status: "ARRIVED",
        orderNumber: `ORD-00${params.id}`,
        qbInvoiceNumber: `INV-00${params.id}`,
        initialDriverNotes:
          params.id === "1" ? "Deliver to back entrance" : undefined,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [params.id]);

  const handleInvoiceCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setInvoiceImage(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!invoiceImage) {
      alert("Please upload a signed invoice image");
      return;
    }

    setSubmitting(true);

    try {
      // In a real implementation, this would call the API to:
      // 1. Upload the invoice image
      // 2. Process returns if any
      // 3. Save driver notes
      // 4. Mark the stop as completed

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect back to route page
      router.push("/driver/route");
    } catch {
      setError("Failed to complete delivery. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !invoiceImage) {
      alert("Please upload a signed invoice image");
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex justify-center items-center h-screen pb-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <Link
          href="/driver/route"
          className="mt-4 inline-block text-green-500 hover:underline"
        >
          &larr; Back to Route
        </Link>
      </div>
    );
  }

  if (!stop) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          Stop not found
        </div>
        <Link
          href="/driver/route"
          className="mt-4 inline-block text-green-500 hover:underline"
        >
          &larr; Back to Route
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Complete Delivery</h1>
        <Link
          href="/driver/route"
          className="text-green-500 hover:text-green-600 transition duration-200"
        >
          &larr; Back
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                Stop {stop.sequence}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Arrived
              </span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-medium text-gray-900">{stop.customer.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{stop.customer.address}</p>

          {stop.orderNumber && (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">Order #:</span>{" "}
              <span className="text-gray-900">{stop.orderNumber}</span>
            </div>
          )}

          {stop.qbInvoiceNumber && (
            <div className="mt-1 text-sm">
              <span className="text-gray-500">Invoice #:</span>{" "}
              <span className="text-gray-900">{stop.qbInvoiceNumber}</span>
            </div>
          )}

          {stop.initialDriverNotes && (
            <div className="mt-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-700">
              <p className="font-medium">Note:</p>
              <p>{stop.initialDriverNotes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-medium text-gray-700">
            {step === 1 && "Upload Signed Invoice"}
            {step === 2 && "Any Returns?"}
            {step === 3 && "Delivery Notes"}
          </h2>
        </div>
        <div className="p-4">
          {step === 1 && (
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Take a photo of the signed invoice and upload it below.
                </p>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleInvoiceCapture}
                    className="hidden"
                    id="invoice-upload"
                  />
                  <label
                    htmlFor="invoice-upload"
                    className="cursor-pointer text-green-500 hover:text-green-600"
                  >
                    {invoiceImage ? (
                      <div className="flex flex-col items-center">
                        <Image
                          src={URL.createObjectURL(invoiceImage)}
                          alt="Signed Invoice"
                          width={200}
                          height={150}
                          className="max-h-40 mb-2 rounded object-contain"
                        />
                        <span className="text-sm text-gray-700">
                          {invoiceImage.name}
                        </span>
                        <span className="text-xs text-green-600 mt-1">
                          Tap to change
                        </span>
                      </div>
                    ) : (
                      <>
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="mt-2 block text-sm text-green-500">
                          Tap to take photo
                        </span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Does the customer have any returns?
              </p>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setHasReturns(true)}
                  className={`flex-1 py-2 px-4 rounded-md border ${
                    hasReturns
                      ? "bg-green-50 border-green-500 text-green-700"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setHasReturns(false)}
                  className={`flex-1 py-2 px-4 rounded-md border ${
                    hasReturns === false
                      ? "bg-green-50 border-green-500 text-green-700"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  No
                </button>
              </div>

              {hasReturns && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-md">
                  <p className="text-sm text-yellow-700 mb-2">
                    Return functionality will be implemented in Phase 5.
                  </p>
                  <p className="text-xs text-yellow-600">
                    For now, please note any returns in the delivery notes.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                Any notes about this delivery? (Optional, visible to admin only)
              </p>
              <textarea
                value={driverNote}
                onChange={(e) => setDriverNote(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                rows={4}
                placeholder="Enter any notes about this delivery..."
              ></textarea>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition duration-200"
              >
                Back
              </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition duration-200"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Completing..." : "Complete Delivery"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
