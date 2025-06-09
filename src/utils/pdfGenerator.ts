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
  returns: ReturnItem[]
): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });
    
    const htmlContent = createHTMLTemplate(stop, imageUrls, returns);
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

function createHTMLTemplate(stop: Stop, imageUrls: ImageUrl[], returns: ReturnItem[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.4;
      color: #000000;
      background: #ffffff;
      font-size: 12px;
    }

    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 25mm;
      background: white;
    }

    /* Professional Header */
    .header {
      border-bottom: 3px solid #000000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }

    .company-info {
      flex: 1;
    }

    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 5px;
      letter-spacing: 1px;
    }

    .company-tagline {
      font-size: 11px;
      color: #666666;
      font-style: italic;
    }

    .document-info {
      text-align: right;
      font-size: 10px;
      color: #000000;
    }

    .document-title {
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      margin: 20px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 2px solid #000000;
      padding: 10px;
      background: #f8f8f8;
    }

    /* Professional Information Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 25px;
    }

    .info-section {
      border: 1px solid #cccccc;
      padding: 15px;
      background: #fafafa;
    }

    .info-section h3 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      text-transform: uppercase;
      border-bottom: 1px solid #000000;
      padding-bottom: 5px;
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
      padding: 15px;
      border: 2px solid #000000;
      background: #f0f0f0;
    }

    .status-badge {
      font-size: 16px;
      font-weight: bold;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 1px;
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
      border: 1px solid #cccccc;
      padding: 10px;
      background: #f9f9f9;
    }

    .photo-link {
      display: block;
      color: #000000;
      text-decoration: underline;
      font-size: 11px;
      margin-bottom: 5px;
      padding: 3px 0;
      border-bottom: 1px dotted #cccccc;
    }

    .photo-link:last-child {
      border-bottom: none;
      margin-bottom: 0;
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

    /* Professional Footer */
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #000000;
      text-align: center;
      font-size: 9px;
      color: #666666;
    }

    .footer-company {
      font-weight: bold;
      color: #000000;
      margin-bottom: 3px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .footer-details {
      color: #666666;
      line-height: 1.3;
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
    <!-- Professional Header -->
    <div class="header">
      <div class="company-header">
        <div class="company-info">
          <div class="company-name">B&R FOOD SERVICES</div>
          <div class="company-tagline">Professional Food Distribution & Delivery Solutions</div>
        </div>
        <div class="document-info">
          <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
          <div><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
          <div><strong>Route:</strong> ${stop.routeNumber}</div>
        </div>
      </div>
    </div>

    <div class="document-title">DELIVERY CONFIRMATION CERTIFICATE</div>

    <!-- Status Section -->
    <div class="status-section">
      <div class="status-badge">DELIVERY COMPLETED</div>
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
            <a href="${baseUrl}${img.url}" class="photo-link">
              Photo ${index + 1}: ${baseUrl}${img.url}
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

    <!-- Professional Footer -->
    <div class="footer">
      <div class="footer-company">B&R Food Services</div>
      <div class="footer-details">
        Professional Food Distribution & Delivery Solutions<br>
        Document Generated: ${new Date().toLocaleString()}<br>
        This document serves as official confirmation of delivery completion.
      </div>
    </div>
  </div>
</body>
</html>`;
}
