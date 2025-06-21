"use client";

import React, { useState } from 'react';

export default function EmailPreviewPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'pdf'>('email');

  // Sample data for preview
  const sampleData = {
    customerName: "ABC Restaurant Supply",
    orderNumber: "WEB-2024-001234",
    deliveryTime: "January 15, 2024 at 2:30 PM",
    routeNumber: "R001",
    driverName: "John Smith",
    customerAddress: "123 Main Street, Downtown, NY 10001",
    documentId: "DOC-A1B2C3D4",
    arrivalTime: "2:15 PM",
    completionTime: "2:30 PM",
    images: [
      { id: 1, name: "Delivery Photo 1" },
      { id: 2, name: "Delivery Photo 2" },
      { id: 3, name: "Delivery Photo 3" }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            📧 Customer Email & PDF Preview
          </h1>
          <p className="text-gray-600">
            This is exactly what customers will receive when their delivery is completed.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('email')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'email'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📧 Email Preview
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'pdf'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📄 PDF Preview
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'email' && (
              <div className="space-y-6">
                {/* Email Client Mockup */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
                    {/* Email Header */}
                    <div className="bg-gray-800 text-white p-4 rounded-t-lg">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="ml-4 text-sm">Customer's Email Client</span>
                      </div>
                    </div>

                    {/* Email Toolbar */}
                    <div className="bg-gray-50 border-b p-3">
                      <div className="text-sm text-gray-600">
                        <strong>From:</strong> B&R Food Services &lt;noreply@brfoodservices.com&gt;
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>To:</strong> {sampleData.customerName} &lt;customer@example.com&gt;
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>Subject:</strong> Your order has been delivered!
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>Attachment:</strong> 📎 Delivery_Confirmation.pdf (1 file)
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="p-6">
                      <div className="text-center mb-6">
                        <div className="text-2xl font-bold text-blue-600 mb-2">
                          🍽️ B&R Food Services
                        </div>
                        <div className="text-xl font-semibold text-gray-800">
                          Your order has been delivered!
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                        <p className="text-gray-700 mb-4">
                          Good news! According to our records, your order has been delivered to you.
                        </p>

                        <div className="space-y-2">
                          <div className="flex items-center">
                            <span className="text-blue-600 mr-2">📦</span>
                            <strong>Order number:</strong> 
                            <span className="ml-2">{sampleData.orderNumber}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-blue-600 mr-2">🏠</span>
                            <strong>Delivered to:</strong> 
                            <span className="ml-2">{sampleData.customerName}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-blue-600 mr-2">⏰</span>
                            <strong>Time:</strong> 
                            <span className="ml-2">{sampleData.deliveryTime}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center">
                          <span className="text-blue-600 mr-2">📎</span>
                          <span className="text-gray-700">
                            Your delivery confirmation document is attached to this email for your records.
                          </span>
                        </div>
                      </div>

                      <div className="text-gray-700 space-y-3">
                        <p>Thank you for choosing B&R Food Services for your food distribution needs.</p>
                        <p>If you have any questions about this delivery, please don't hesitate to contact us.</p>
                        <p className="font-medium">
                          Best regards,<br />
                          The B&R Food Services Team
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Features */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">✅ Email Features:</h3>
                  <ul className="text-blue-700 space-y-1 text-sm">
                    <li>• Clean, professional design with company branding</li>
                    <li>• Essential information only (order number, customer, time)</li>
                    <li>• PDF attachment with detailed delivery confirmation</li>
                    <li>• Mobile-responsive HTML email</li>
                    <li>• Friendly, customer-focused messaging</li>
                    <li>• No returns section (as requested)</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'pdf' && (
              <div className="space-y-6">
                {/* PDF Mockup */}
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="bg-white rounded-lg shadow-lg max-w-3xl mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {/* PDF Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-lg text-center">
                      <div className="text-2xl font-bold mb-2">🍽️ B&R Food Services</div>
                      <div className="text-lg opacity-90 mb-4">Your trusted food distribution partner</div>
                      <div className="bg-white bg-opacity-20 rounded-lg p-3 inline-block">
                        <div className="text-sm">
                          Document #: {sampleData.documentId} | {new Date().toLocaleDateString()} | Route: {sampleData.routeNumber}
                        </div>
                      </div>
                    </div>

                    {/* PDF Title */}
                    <div className="text-center py-6 bg-blue-50 border-l-4 border-blue-500">
                      <div className="text-2xl font-semibold text-blue-600">
                        ✅ Delivery Completed Successfully!
                      </div>
                    </div>

                    {/* Status Section */}
                    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white text-center py-5 mx-6 my-6 rounded-lg">
                      <div className="text-xl font-semibold">🎉 Delivery Completed Successfully!</div>
                    </div>

                    {/* Information Grid */}
                    <div className="grid grid-cols-2 gap-6 px-6 mb-6">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">
                          Customer Information
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium text-gray-700">Customer Name:</span>
                            <div className="text-gray-900">{sampleData.customerName}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Delivery Address:</span>
                            <div className="text-gray-900">{sampleData.customerAddress}</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm">
                        <h3 className="text-lg font-semibold text-blue-600 border-b-2 border-blue-600 pb-2 mb-4">
                          Delivery Details
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <span className="font-medium text-gray-700">Arrival Time:</span>
                            <div className="text-gray-900">{sampleData.arrivalTime}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Completion Time:</span>
                            <div className="text-gray-900">{sampleData.completionTime}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Route Number:</span>
                            <div className="text-gray-900">{sampleData.routeNumber}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Photo Documentation */}
                    <div className="mx-6 mb-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-blue-600 mb-4">📸 Delivery Photo Documentation</h3>
                        <div className="text-gray-700 mb-4">
                          Total Photos Captured: {sampleData.images.length}
                        </div>
                        <div className="text-gray-600 mb-4">
                          The following photographic evidence has been captured to document the delivery completion.
                          Click on the links below to access the images:
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {sampleData.images.map((img, index) => (
                            <div
                              key={img.id}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700 transition-colors"
                            >
                              📸 View Image {index + 1}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-blue-50 border-t-4 border-blue-600 text-center p-6 rounded-b-lg">
                      <div className="text-lg font-semibold text-blue-600 mb-2">🍽️ B&R Food Services</div>
                      <div className="text-gray-600 leading-relaxed">
                        Thank you for choosing B&R Food Services!<br />
                        Generated: {new Date().toLocaleString()}<br />
                        Questions? Contact us anytime - we're here to help! 😊
                      </div>
                    </div>
                  </div>
                </div>

                {/* PDF Features */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">✅ PDF Design Features:</h3>
                  <ul className="text-green-700 space-y-1 text-sm">
                    <li>• Modern, user-friendly design with colors and gradients</li>
                    <li>• Masked URLs behind clickable buttons (no long links shown)</li>
                    <li>• Friendly emojis and welcoming language</li>
                    <li>• Professional yet approachable appearance</li>
                    <li>• Clean typography with readable fonts</li>
                    <li>• Rounded corners and modern styling</li>
                    <li>• Customer-focused messaging throughout</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Before vs After Comparison</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 mb-3">❌ Before (Too Serious)</h3>
              <ul className="text-red-700 space-y-2 text-sm">
                <li>• All caps text: "DELIVERY CONFIRMATION CERTIFICATE"</li>
                <li>• Black and white formal design</li>
                <li>• Long URLs displayed in full</li>
                <li>• Corporate/legal document appearance</li>
                <li>• Intimidating formal language</li>
                <li>• Times New Roman font</li>
                <li>• No colors or visual appeal</li>
              </ul>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-3">✅ After (User-Friendly)</h3>
              <ul className="text-green-700 space-y-2 text-sm">
                <li>• Friendly title: "✅ Delivery Completed Successfully!"</li>
                <li>• Colorful gradients and modern design</li>
                <li>• Masked URLs: "📸 View Image 1"</li>
                <li>• Welcoming, customer-focused appearance</li>
                <li>• Helpful, friendly language</li>
                <li>• Modern system fonts</li>
                <li>• Beautiful colors and visual hierarchy</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
