'use client';

interface EmailResultsModalProps {
  show: boolean;
  emailResults: any;
  onClose: () => void;
}

export default function EmailResultsModal({
  show,
  emailResults,
  onClose
}: EmailResultsModalProps) {
  if (!show || !emailResults) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              📧 Email Sending Results
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">
                Route: {emailResults.route?.routeNumber || 'N/A'}
              </h4>
              <p className="text-sm text-gray-600 mb-2">
                {emailResults.summary}
              </p>
              <div className="flex space-x-4 text-sm">
                <span className="text-green-600">
                  ✅ Sent: {emailResults.results?.sent || 0}
                </span>
                <span className="text-red-600">
                  ❌ Failed: {emailResults.results?.failed || 0}
                </span>
                <span className="text-gray-600">
                  📊 Total: {emailResults.results?.total || 0}
                </span>
              </div>
            </div>
          </div>

          {emailResults.results?.details && emailResults.results.details.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              <h4 className="font-medium text-gray-900 mb-2">Detailed Results:</h4>
              <div className="space-y-2">
                {emailResults.results.details.map((detail: any, index: number) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      detail.status === 'sent'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900">
                          {detail.customer}
                        </span>
                        <span className="text-sm text-gray-600 ml-2">
                          (Order: {detail.orderNumber})
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${
                        detail.status === 'sent' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {detail.status === 'sent' ? '✅ Sent' : '❌ Failed'}
                      </span>
                    </div>
                    {detail.error && (
                      <p className="text-sm text-red-600 mt-1">
                        Error: {detail.error}
                      </p>
                    )}
                    {detail.messageId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Message ID: {detail.messageId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {emailResults.results?.errors && emailResults.results.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-700 space-y-1">
                  {emailResults.results.errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
