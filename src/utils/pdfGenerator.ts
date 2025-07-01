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
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
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
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.4;
      color: #000000;
      background: #ffffff;
      font-size: 12px;
    }

    .container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 15mm;
      background: white;
    }

    /* Clean Professional Header */
    .header {
      border: 2px solid #000000;
      padding: 20px;
      margin-bottom: 25px;
      text-align: center;
    }

    .company-header {
      margin-bottom: 15px;
    }

    .company-info {
      text-align: center;
    }

    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .company-tagline {
      font-size: 12px;
      color: #000000;
      margin-bottom: 15px;
      font-style: italic;
    }

    .document-info {
      border: 1px solid #000000;
      padding: 8px 12px;
      font-size: 10px;
      color: #000000;
      display: inline-block;
      background: #ffffff;
    }

    .document-title {
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      color: #000000;
      margin: 20px 0;
      padding: 12px;
      border: 1px solid #000000;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* Clean Information Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
      margin-bottom: 20px;
    }

    .info-section {
      border: 1px solid #000000;
      padding: 15px;
      background: #ffffff;
    }

    .info-section h3 {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #000000;
      border-bottom: 1px solid #000000;
      padding-bottom: 5px;
      text-transform: uppercase;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 10px;
    }

    .info-label {
      font-weight: bold;
      color: #000000;
    }

    .info-value {
      color: #000000;
    }

    .status-section {
      text-align: center;
      margin: 15px 0;
      padding: 15px;
      border: 2px solid #000000;
      background: #ffffff;
    }

    .status-badge {
      font-size: 14px;
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

    /* Clean Photo Section */
    .photo-instruction {
      font-size: 10px;
      color: #000000;
      margin-bottom: 10px;
    }

    .photo-count {
      font-size: 10px;
      color: #000000;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .photo-links {
      background: #ffffff;
      border: 1px solid #000000;
      padding: 10px;
    }

    .photo-link {
      display: inline-block;
      background: #ffffff;
      color: #000000;
      text-decoration: underline;
      font-size: 10px;
      font-weight: normal;
      margin: 3px 8px 3px 0;
      padding: 4px 8px;
      border: 1px solid #000000;
    }

    .photo-link:hover {
      background: #f0f0f0;
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

    /* Clean Notes Section */
    .notes-content {
      border: 1px solid #000000;
      padding: 10px;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.3;
      color: #000000;
    }

    .note-item {
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid #cccccc;
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

    /* Clean Footer */
    .footer {
      margin-top: 30px;
      padding: 15px;
      background: #ffffff;
      text-align: center;
      font-size: 10px;
      color: #000000;
      border-top: 2px solid #000000;
    }

    .footer-company {
      font-size: 12px;
      font-weight: bold;
      color: #000000;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .footer-details {
      line-height: 1.4;
      color: #000000;
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
          <div class="company-name">B&R Food Services</div>
          <div class="company-tagline">Professional Food Distribution Services</div>
        </div>
      </div>
      <div class="document-info">
        Document #: ${stop.id.substring(0, 8).toUpperCase()} | ${new Date().toLocaleDateString()} | Route: ${stop.routeNumber}
      </div>
    </div>

    <div class="document-title">Delivery Confirmation Statement</div>

    <!-- Status Section -->
    <div class="status-section">
      <div class="status-badge">Delivery Completed</div>
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
              Image ${index + 1}
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
        Professional Food Distribution Services<br>
        Document Generated: ${new Date().toLocaleString()}<br>
        For inquiries, please contact our customer service department.
      </div>
    </div>
  </div>
</body>
</html>`;
}
