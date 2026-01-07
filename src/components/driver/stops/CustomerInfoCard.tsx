'use client';

import { formatDriverNotes } from '@/utils/notesFormatter';
import GoogleMapsLink from '@/components/ui/GoogleMapsLink';
import LinkifiedText from '@/components/ui/LinkifiedText';

interface Customer {
  id: string;
  name: string;
  address: string;
  contactInfo: string | null;
  preferences: string | null;
  paymentTerms?: string | null;
  deliveryInstructions?: string | null;
}

interface Stop {
  sequence: number;
  amount: number | null;
  orderNumberWeb: string | null;
  quickbooksInvoiceNum: string | null;
  initialDriverNotes: string | null;
  paymentTerms?: string | null;
  paymentTermsOther?: string | null;
  customer: Customer;
  route: {
    id: string;
    routeNumber: string | null;
    date: string;
  };
  adminNotes?: Array<{
    id: string;
    note: string;
    createdAt: string;
    admin: {
      username: string;
      fullName: string | null;
    };
  }>;
}

interface CustomerInfoCardProps {
  stop: Stop;
  formatDate: (date: string | null) => string;
}

export default function CustomerInfoCard({ stop, formatDate }: CustomerInfoCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-200">
        <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              {stop.customer.name}
            </h1>
            <div className="flex items-start sm:items-center mt-1 text-gray-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5 sm:mt-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <p className="text-sm break-words flex-1">
                {stop.customer.address}
              </p>
            </div>

            {/* Google Maps Navigation Link */}
            <div className="mt-2">
              <GoogleMapsLink
                address={stop.customer.address}
                customerName={stop.customer.name}
                type="directions"
                variant="link"
                size="sm"
              >
                📍 Get Directions
              </GoogleMapsLink>
            </div>
          </div>
          <div className="flex flex-row sm:flex-col justify-between sm:items-end bg-gray-50 sm:bg-transparent p-2 rounded-lg sm:p-0">
            <div className="flex items-center">
              <span className="text-xs sm:text-sm font-medium text-gray-500 mr-1 sm:mr-2">
                Route:
              </span>
              <span className="text-xs sm:text-sm font-bold">
                {stop.route.routeNumber || "N/A"}
              </span>
            </div>
            <div className="flex items-center">
              <span className="text-xs sm:text-sm font-medium text-gray-500 mr-1 sm:mr-2">
                Date:
              </span>
              <span className="text-xs sm:text-sm">
                {formatDate(stop.route.date)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* Delivery Details - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-4">
          <div className="col-span-2 sm:col-span-1">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Invoice #
              </span>
              <span className="font-medium text-gray-900 text-sm sm:text-base text-overflow-safe">
                {stop.quickbooksInvoiceNum &&
                  stop.quickbooksInvoiceNum.trim() !== ""
                  ? stop.quickbooksInvoiceNum
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Order # (Web)
              </span>
              <span className="font-medium text-gray-900 text-sm sm:text-base text-overflow-safe">
                {stop.orderNumberWeb && stop.orderNumberWeb.trim() !== ""
                  ? stop.orderNumberWeb
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="col-span-1">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Sequence
              </span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">
                {stop.sequence}
              </span>
            </div>
          </div>
          <div className="col-span-1">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Amount
              </span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">
                {stop.amount ? `$${stop.amount.toFixed(2)}` : "N/A"}
              </span>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                Payment Terms
              </span>
              <span className="font-medium text-gray-900 text-sm sm:text-base">
                {stop.paymentTerms || stop.customer.paymentTerms || "COD"}
                {stop.paymentTerms === "Other" && stop.paymentTermsOther && (
                  <span className="text-xs text-gray-500 ml-1">({stop.paymentTermsOther})</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* All Instructions - Mobile Optimized */}
        {(stop.initialDriverNotes || (stop.adminNotes && stop.adminNotes.length > 0) || stop.customer.preferences || stop.customer.deliveryInstructions) && (
          <div className="mt-5 sm:mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mt-0.5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-2 sm:ml-3 w-full">
                <h3 className="text-sm font-medium text-blue-800">
                  All Instructions
                </h3>

                {/* Admin Notes */}
                {stop.adminNotes && stop.adminNotes.length > 0 && (
                  <div className="mt-2 sm:mt-3">
                    <h4 className="text-xs font-semibold text-red-900 uppercase tracking-wide mb-2 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Admin Instructions:
                    </h4>
                    <div className="space-y-2">
                      {stop.adminNotes.map((note, index) => (
                        <div key={note.id} className="bg-red-100 border border-red-300 rounded p-2 text-sm">
                          <p className="text-red-800 font-medium whitespace-pre-wrap break-words">
                            <LinkifiedText text={note.note} />
                          </p>
                          <p className="text-xs text-red-600 mt-1">
                            — {note.admin.fullName || note.admin.username} ({new Date(note.createdAt).toLocaleDateString()})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer Preferences */}
                {stop.customer.preferences && (
                  <div className="mt-2 sm:mt-3">
                    <h4 className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-1 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Customer Preferences:
                    </h4>
                    <div className="bg-green-100 border border-green-300 rounded p-2 text-sm text-green-800 respect-boundaries">
                      <p className="break-words-safe">{stop.customer.preferences}</p>
                    </div>
                  </div>
                )}

                {/* Customer Delivery Instructions */}
                {stop.customer.deliveryInstructions && (
                  <div className="mt-2 sm:mt-3">
                    <h4 className="text-xs font-semibold text-purple-900 uppercase tracking-wide mb-1 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      Customer Delivery Instructions:
                    </h4>
                    <div className="bg-purple-100 border border-purple-300 rounded p-2 text-sm text-purple-800 respect-boundaries">
                      <p className="break-words-safe">
                        <LinkifiedText text={stop.customer.deliveryInstructions} />
                      </p>
                    </div>
                  </div>
                )}

                {/* Driver Instructions */}
                {stop.initialDriverNotes && (
                  <div className="mt-2 sm:mt-3">
                    <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Delivery Instructions:
                    </h4>
                    <div className="bg-blue-100 border border-blue-300 rounded p-2 text-sm text-blue-800 respect-boundaries">
                      <p className="break-words-safe">
                        <LinkifiedText text={formatDriverNotes(stop.initialDriverNotes)} />
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
