const fs = require('fs');
const path = require('path');

// Sample data that matches your PDF generator interface
const sampleStopData = {
  id: 'test-stop-123',
  customerName: 'Customer Name',
  customerAddress: '123 Main Street, Los Angeles, CA 90210',
  routeNumber: 'R001',
  arrivalTime: new Date().toISOString(),
  completionTime: new Date().toISOString(),
  driverNotes: 'Delivery completed successfully. Customer was very satisfied.',
  adminNotes: 'Special handling required for fragile items.',
  orderNumberWeb: '12345',
  quickbooksInvoiceNum: '12345',
  amount: 5678.00,
  driverPaymentAmount: 5678.00,
  driverPaymentMethods: ['Cash', 'Check', 'Card'],
  paymentFlagNotPaid: false,
  payments: [
    {
      id: 'payment-1',
      amount: 3000.00,
      method: 'Cash',
      notes: 'Cash payment received'
    },
    {
      id: 'payment-2',
      amount: 2678.00,
      method: 'Check',
      notes: 'Check #1234'
    }
  ]
};

const sampleImageUrls = [
  {
    url: '/uploads/sample-image-1.jpg',
    name: 'Delivery Photo 1'
  },
  {
    url: '/uploads/sample-image-2.jpg',
    name: 'Delivery Photo 2'
  }
];

const sampleReturns = [
  {
    id: 'return-1',
    productSku: 'SKU-001',
    productDescription: 'Premium Organic Vegetables',
    quantity: 2,
    reasonCode: 'Customer requested different variety'
  },
  {
    id: 'return-2',
    productSku: 'SKU-002',
    productDescription: 'Fresh Dairy Products',
    quantity: 1,
    reasonCode: 'Packaging damaged during transport'
  }
];

// Copy of your PDF generator HTML template function
function createHTMLTemplate(stop, imageUrls, returns, baseUrl = 'http://localhost:3000') {
  const totalPaymentAmount = stop.driverPaymentAmount || 0;
  const paymentMethods = stop.driverPaymentMethods || [];
  const paymentStatus = stop.paymentFlagNotPaid ? 'Not paid' : 'Paid';
  const invoiceNumber = stop.quickbooksInvoiceNum || stop.orderNumberWeb || 'N/A';
  const totalAmount = stop.amount || 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>B&R Food Services - Delivery Confirmation</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      line-height: 1.5;
      color: #000000;
      background: #ffffff;
      font-size: 14px;
    }

    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
    }

    /* Professional Header with Truck Image */
    .header {
      position: relative;
      margin-bottom: 30px;
      background: #ffffff;
    }

    .truck-image {
      width: 100%;
      height: 200px;
      background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDgwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPCEtLSBCYWNrZ3JvdW5kIC0tPgogIDxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjNDI2M0VCIi8+CiAgCiAgPCEtLSBDb21wYW55IE5hbWUgLS0+CiAgPHRleHQgeD0iNDAwIiB5PSI4MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjM2IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkImYW1wO1IgRk9PRCBTRVJWSUNFUZO8L3RleHQ+CiAgCiAgPCEtLSBUYWdsaW5lIC0tPgogIDx0ZXh0IHg9IjQwMCIgeT0iMTIwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5jdXR0aW5nIHByaWNlczwvdGV4dD4KICA8IS0tIERlY29yYXRpdmUgZWxlbWVudHMgLS0+CiAgPGNpcmNsZSBjeD0iMTAwIiBjeT0iMTAwIiByPSIzMCIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMiIvPgogIDxjaXJjbGUgY3g9IjcwMCIgY3k9IjEwMCIgcj0iMzAiIGZpbGw9IndoaXRlIiBvcGFjaXR5PSIwLjIiLz4KICA8IS0tIEZvcmsgYW5kIGtuaWZlIGljb25zIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDUwLCA4MCkiPgogICAgPHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjIiIGhlaWdodD0iNDAiIGZpbGw9IndoaXRlIi8+CiAgICA8cmVjdCB4PSI4IiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0id2hpdGUiLz4KICAgIDxyZWN0IHg9IjE2IiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0id2hpdGUiLz4KICAgIDxyZWN0IHg9IjI0IiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0id2hpdGUiLz4KICAgIDxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIyNiIgaGVpZ2h0PSI4IiBmaWxsPSJ3aGl0ZSIvPgogIDwvZz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg3MjAsIDgwKSI+CiAgICA8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMiIgaGVpZ2h0PSI0MCIgZmlsbD0id2hpdGUiLz4KICAgIDxjaXJjbGUgY3g9IjEiIGN5PSI4IiByPSIzIiBmaWxsPSJ3aGl0ZSIvPgogIDwvZz4KPC9zdmc+') center/cover no-repeat;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .customer-section {
      background: #ffffff;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }

    .customer-name {
      font-size: 36px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 20px;
    }

    .thank-you-message {
      font-size: 16px;
      color: #000000;
      margin-bottom: 30px;
      line-height: 1.6;
    }

    .invoice-section {
      background: #ffffff;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }

    .invoice-number {
      font-size: 28px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 15px;
    }

    .total-amount {
      font-size: 24px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 30px;
    }

    .company-signature {
      font-size: 18px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 30px;
    }

    .payment-section {
      background: #ffffff;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }

    .payment-received {
      font-size: 16px;
      color: #000000;
      margin-bottom: 10px;
    }

    .payment-methods {
      font-size: 16px;
      color: #000000;
      font-style: italic;
      margin-bottom: 30px;
    }

    .returns-section {
      background: #ffffff;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }

    .returns-title {
      font-size: 16px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 15px;
    }

    .document-links {
      background: #ffffff;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }

    .document-link {
      display: inline-block;
      background: #4263EB;
      color: white;
      padding: 8px 16px;
      text-decoration: none;
      border-radius: 4px;
      margin: 5px;
      font-size: 14px;
    }

    .document-link:hover {
      background: #3651DB;
    }

    .footer-section {
      background: #DC2626;
      color: white;
      padding: 20px;
      text-align: center;
      margin-top: 30px;
    }

    .footer-contact {
      font-size: 14px;
      line-height: 1.6;
    }

    /* Returns table styling */
    .returns-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }

    .returns-table th,
    .returns-table td {
      border: 1px solid #000000;
      padding: 8px;
      text-align: left;
    }

    .returns-table th {
      background: #f5f5f5;
      font-weight: bold;
    }

    /* Print optimization */
    @media print {
      body { -webkit-print-color-adjust: exact; }
      .container { padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Professional Header with Truck Image -->
    <div class="header">
      <div class="truck-image"></div>
    </div>

    <!-- Customer Section -->
    <div class="customer-section">
      <div class="customer-name">${stop.customerName}</div>
      <div class="thank-you-message">
        Thank you for being a loyal customer.<br><br>
        Please review attached documents, including today's invoice, credit memo, and any other delivery related document.
      </div>
    </div>

    <!-- Invoice Section -->
    <div class="invoice-section">
      <div class="invoice-number">INVOICE # ${invoiceNumber}</div>
      <div class="total-amount">TOTAL AMOUNT: $${totalAmount.toFixed(2)}</div>
      
      <div class="company-signature">
        Thank you,<br>
        <strong>B&R Food Services</strong>
      </div>
    </div>

    <!-- Payment Section -->
    <div class="payment-section">
      <div class="payment-received">Payment received at the time of the delivery</div>
      <div class="payment-methods">${paymentMethods.length > 0 ? paymentMethods.join(' / ') : 'Cash / Check / Card / Zelle'}</div>
    </div>

    <!-- Returns Section -->
    ${returns.length > 0 ? `
    <div class="returns-section">
      <div class="returns-title">Returns to the driver for credit:</div>
      <table class="returns-table">
        <thead>
          <tr>
            <th>PRODUCT SKU</th>
            <th>PRODUCT DESCRIPTION</th>
            <th>QTY</th>
            <th>RETURN REASON</th>
          </tr>
        </thead>
        <tbody>
          ${returns.map(item => `
            <tr>
              <td>${item.productSku || 'N/A'}</td>
              <td>${item.productDescription || 'N/A'}</td>
              <td>${item.quantity}</td>
              <td>${item.reasonCode || 'Driver Return'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Document Links Section -->
    ${imageUrls.length > 0 ? `
    <div class="document-links">
      <div style="margin-bottom: 15px; font-weight: bold;">Click here for your signed invoice 👉</div>
      ${imageUrls.map((img, index) => `
        <a href="${baseUrl}${img.url}" class="document-link">
          Image ${index + 1}
        </a>
      `).join('')}
      <div style="margin-top: 15px; font-weight: bold;">Click here for the PDF invoice 👉</div>
    </div>
    ` : ''}

    <!-- Footer Section -->
    <div class="footer-section">
      <div class="footer-contact">
        24/7 customer service | (323) 456-0897 | customer.service@brfood.us
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Function to generate HTML preview
function generateTestHTML() {
  console.log('Generating HTML preview...');

  const htmlContent = createHTMLTemplate(sampleStopData, sampleImageUrls, sampleReturns);

  // Save the HTML to the current directory
  const outputPath = path.join(__dirname, 'test-delivery-confirmation.html');
  fs.writeFileSync(outputPath, htmlContent);

  console.log(`✅ HTML preview generated successfully!`);
  console.log(`📄 File saved as: ${outputPath}`);
  console.log(`🌐 Open this file in your browser to see the PDF design!`);

  return htmlContent;
}

// Run the test
try {
  generateTestHTML();
  console.log('\n🎉 Test completed successfully!');
  console.log('📋 Next steps:');
  console.log('   1. Open "test-delivery-confirmation.html" in your browser');
  console.log('   2. Use browser Print Preview (Ctrl/Cmd + P) to see PDF layout');
  console.log('   3. You can also print to PDF from the browser');
  console.log('\n💡 This shows exactly what your customers will receive!');
} catch (error) {
  console.error('❌ Error generating HTML:', error);
  process.exit(1);
}
