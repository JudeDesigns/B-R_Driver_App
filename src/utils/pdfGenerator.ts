import puppeteer from 'puppeteer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface Stop {
  id: string;
  customerName: string;
  customerAddress: string;
  routeNumber: string;
  arrivalTime: string | null;
  completionTime: string | null;
  driverNotes: string | null;
  adminNotes: string | null;
}

interface ReturnItem {
  id: string;
  productSku: string;
  productDescription: string;
  quantity: number;
  reasonCode: string;
}

interface ImageUrl {
  url: string;
  name: string;
}

export async function generateDeliveryPDF(
  stop: Stop,
  imageUrls: ImageUrl[],
  returns: ReturnItem[],
  baseUrl?: string
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });
    
    const htmlContent = createHTMLTemplate(stop, imageUrls, returns, baseUrl);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function createHTMLTemplate(stop: Stop, imageUrls: ImageUrl[], returns: ReturnItem[], baseUrl?: string): string {
  // Use provided baseUrl or fallback to environment variable or localhost
  const finalBaseUrl = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background: #ffffff;
      font-size: 14px;
    }

    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
    }

    /* Friendly Header */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }

    .company-header {
      margin-bottom: 15px;
    }

    .company-info {
      text-align: center;
    }

    .company-name {
      font-size: 28px;
      font-weight: 700;
      color: white;
      margin-bottom: 8px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    .company-tagline {
      font-size: 14px;
      color: rgba(255,255,255,0.9);
      margin-bottom: 15px;
    }

    .document-info {
      background: rgba(255,255,255,0.1);
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      color: white;
      display: inline-block;
    }

    .document-title {
      text-align: center;
      font-size: 24px;
      font-weight: 600;
      color: #667eea;
      margin: 25px 0;
      padding: 15px;
      background: #f8f9ff;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    /* Friendly Information Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
    }

    .info-section {
      border: 1px solid #e5e7eb;
      padding: 20px;
      background: #f9fafb;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .info-section h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
      color: #667eea;
      border-bottom: 2px solid #667eea;
      padding-bottom: 8px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 11px;
    }

    .info-label {
      font-weight: bold;
      color: #000000;
    }

    .info-value {
      color: #333333;
    }

    .status-section {
      text-align: center;
      margin: 20px 0;
      padding: 20px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 12px;
      color: white;
    }

    .status-badge {
      font-size: 20px;
      font-weight: 600;
      color: white;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    /* Professional Content Sections */
    .section {
      margin-bottom: 25px;
      border: 1px solid #000000;
      background: #ffffff;
    }

    .section-header {
      background: #000000;
      color: #ffffff;
      padding: 8px 15px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .section-content {
      padding: 15px;
    }

    .section-title {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #000000;
      text-transform: uppercase;
      border-bottom: 1px solid #cccccc;
      padding-bottom: 5px;
    }

    /* Professional Photo Section */
    .photo-instruction {
      font-size: 11px;
      color: #333333;
      margin-bottom: 15px;
      font-style: italic;
    }

    .photo-count {
      font-size: 11px;
      color: #000000;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .photo-links {
      background: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 15px;
    }

    .photo-link {
      display: inline-block;
      background: #667eea;
      color: white;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
      margin: 5px 10px 5px 0;
      padding: 8px 16px;
      border-radius: 6px;
      transition: background-color 0.2s;
    }

    .photo-link:hover {
      background: #5a67d8;
    }

    /* Professional Returns Table */
    .returns-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      border: 1px solid #000000;
    }

    .returns-table th {
      background: #000000;
      color: #ffffff;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      border: 1px solid #000000;
    }

    .returns-table td {
      padding: 6px 8px;
      border: 1px solid #cccccc;
      font-size: 10px;
      vertical-align: top;
    }

    .returns-table tr:nth-child(even) {
      background: #f8f8f8;
    }

    .returns-summary {
      margin-top: 10px;
      font-size: 11px;
      font-weight: bold;
      text-align: right;
      color: #000000;
    }

    /* Professional Notes Section */
    .notes-content {
      border: 1px solid #cccccc;
      padding: 10px;
      background: #f9f9f9;
      font-size: 10px;
      line-height: 1.4;
      color: #333333;
    }

    .note-item {
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px dotted #cccccc;
    }

    .note-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .note-label {
      font-weight: bold;
      color: #000000;
      text-transform: uppercase;
      font-size: 9px;
    }

    /* Friendly Footer */
    .footer {
      margin-top: 40px;
      padding: 20px;
      background: #f8f9ff;
      border-radius: 8px;
      text-align: center;
      font-size: 12px;
      color: #667eea;
      border-top: 3px solid #667eea;
    }

    .footer-company {
      font-size: 16px;
      font-weight: 600;
      color: #667eea;
      margin-bottom: 10px;
    }

    .footer-details {
      line-height: 1.6;
      color: #6b7280;
    }

    /* Print Styles */
    @media print {
      body { -webkit-print-color-adjust: exact; }
      .section { break-inside: avoid; }
    }

    /* No content states */
    .no-content {
      text-align: center;
      color: #6b7280;
      font-style: italic;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Friendly Header -->
    <div class="header">
      <div class="company-header">
        <div class="company-info">
          <div class="company-name">🍽️ B&R Food Services</div>
          <div class="company-tagline">Your trusted food distribution partner</div>
        </div>
      </div>
      <div class="document-info">
        Document #: ${stop.id.substring(0, 8).toUpperCase()} | ${new Date().toLocaleDateString()} | Route: ${stop.routeNumber}
      </div>
    </div>

    <div class="document-title">✅ Delivery Completed Successfully!</div>

    <!-- Status Section -->
    <div class="status-section">
      <div class="status-badge">🎉 Delivery Completed Successfully!</div>
    </div>

    <!-- Information Grid -->
    <div class="info-grid">
      <div class="info-section">
        <h3>Customer Information</h3>
        <div class="info-row">
          <span class="info-label">Customer Name:</span>
          <span class="info-value">${stop.customerName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Delivery Address:</span>
          <span class="info-value">${stop.customerAddress}</span>
        </div>
      </div>

      <div class="info-section">
        <h3>Delivery Details</h3>
        ${stop.arrivalTime ? `
        <div class="info-row">
          <span class="info-label">Arrival Time:</span>
          <span class="info-value">${new Date(stop.arrivalTime).toLocaleString()}</span>
        </div>` : ''}
        ${stop.completionTime ? `
        <div class="info-row">
          <span class="info-label">Completion Time:</span>
          <span class="info-value">${new Date(stop.completionTime).toLocaleString()}</span>
        </div>` : ''}
        <div class="info-row">
          <span class="info-label">Route Number:</span>
          <span class="info-value">${stop.routeNumber}</span>
        </div>
      </div>
    </div>

    ${imageUrls.length > 0 ? `
    <!-- Professional Photo Documentation -->
    <div class="section">
      <div class="section-header">DELIVERY PHOTO DOCUMENTATION</div>
      <div class="section-content">
        <div class="photo-count">Total Photos Captured: ${imageUrls.length}</div>
        <div class="photo-instruction">
          The following photographic evidence has been captured to document the delivery completion.
          Click on the links below to access the images:
        </div>

        <div class="photo-links">
          ${imageUrls.map((img, index) => `
            <a href="${finalBaseUrl}${img.url}" class="photo-link">
              📸 View Image ${index + 1}
            </a>
          `).join('')}
        </div>
      </div>
    </div>
    ` : ''}

    ${returns.length > 0 ? `
    <!-- Professional Returns Documentation -->
    <div class="section">
      <div class="section-header">RETURNED MERCHANDISE REPORT</div>
      <div class="section-content">
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
        <div class="returns-summary">
          Total Items Returned: ${returns.reduce((sum, item) => sum + item.quantity, 0)}
        </div>
      </div>
    </div>
    ` : ''}

    ${(stop.driverNotes || stop.adminNotes) ? `
    <!-- Professional Notes Section -->
    <div class="section">
      <div class="section-header">DELIVERY NOTES & COMMENTS</div>
      <div class="section-content">
        <div class="notes-content">
          ${stop.driverNotes ? `
            <div class="note-item">
              <div class="note-label">Driver Notes:</div>
              <div>${stop.driverNotes}</div>
            </div>
          ` : ''}
          ${stop.adminNotes ? `
            <div class="note-item">
              <div class="note-label">Administrative Instructions:</div>
              <div>${stop.adminNotes}</div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Friendly Footer -->
    <div class="footer">
      <div class="footer-company">🍽️ B&R Food Services</div>
      <div class="footer-details">
        Thank you for choosing B&R Food Services!<br>
        Generated: ${new Date().toLocaleString()}<br>
        Questions? Contact us anytime - we're here to help! 😊
      </div>
    </div>
  </div>
</body>
</html>`;
}
