'use client';

interface PaymentEntry {
  amount: string;
  method: string;
  notes: string;
}

interface Stop {
  driverPaymentAmount?: number;
}

interface PaymentModalProps {
  show: boolean;
  stop: Stop | null;
  paymentEntries: PaymentEntry[];
  paymentError: string;
  savingPayment: boolean;
  onClose: () => void;
  addPaymentEntry: () => void;
  removePaymentEntry: (index: number) => void;
  updatePaymentEntry: (index: number, field: string, value: string) => void;
  handleSavePayment: () => void;
  setPaymentError: (error: string) => void;
  setPaymentEntries: (entries: PaymentEntry[]) => void;
}

export default function PaymentModal({
  show,
  stop,
  paymentEntries,
  paymentError,
  savingPayment,
  onClose,
  addPaymentEntry,
  removePaymentEntry,
  updatePaymentEntry,
  handleSavePayment,
  setPaymentError,
  setPaymentEntries
}: PaymentModalProps) {
  if (!show) return null;

  const handleClose = () => {
    onClose();
    setPaymentError("");
    setPaymentEntries([{amount: "", method: "", notes: ""}]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {stop && stop.driverPaymentAmount && stop.driverPaymentAmount > 0 ? "Update Payment" : "Record Payment Received"}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Payment Entries</h4>
              <button
                type="button"
                onClick={addPaymentEntry}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Another Payment
              </button>
            </div>

            {paymentEntries.map((entry, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Payment {index + 1}
                  </span>
                  {paymentEntries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePaymentEntry(index)}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.amount}
                      onChange={(e) => updatePaymentEntry(index, 'amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Method
                    </label>
                    <select
                      value={entry.method}
                      onChange={(e) => updatePaymentEntry(index, 'method', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select method</option>
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                      <option value="Credit Card">Credit Card</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={entry.notes}
                    onChange={(e) => updatePaymentEntry(index, 'notes', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Check number, reference, etc."
                  />
                </div>
              </div>
            ))}

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700">
                Total Amount: $
                {paymentEntries
                  .filter(entry => entry.amount && parseFloat(entry.amount) > 0)
                  .reduce((sum, entry) => sum + parseFloat(entry.amount), 0)
                  .toFixed(2)
                }
              </div>
            </div>

            {/* Error Message */}
            {paymentError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {paymentError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleClose}
                disabled={savingPayment}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                disabled={savingPayment || paymentEntries.filter(entry => entry.amount && parseFloat(entry.amount) > 0 && entry.method).length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center"
              >
                {savingPayment ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
