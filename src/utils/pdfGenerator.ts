import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';


// Function to convert image to base64
async function imageToBase64(imagePath: string): Promise<string | null> {
  try {
    const fullPath = path.join(process.cwd(), 'public', imagePath.replace('/uploads/', 'uploads/'));

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      console.warn(`⚠️ Image file not found: ${fullPath}`);
      return null;
    }

    const stats = await fs.stat(fullPath);
    const imageBuffer = await fs.readFile(fullPath);
    const base64 = imageBuffer.toString('base64');

    // Determine MIME type based on file extension
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg'; // default

    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    console.log(`📄 Image converted: ${imagePath} (${(stats.size / 1024).toFixed(1)}KB)`);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn(`⚠️ Failed to convert image to base64: ${imagePath}`, error);
    return null;
  }
}

interface Stop {
  id: string;
  customerName: string;
  customerAddress: string;
  routeNumber: string;
  arrivalTime: string | null;
  completionTime: string | null;
  driverNotes: string | null;
  adminNotes: string | null;
  orderNumberWeb: string | null;
  quickbooksInvoiceNum: string | null;
  amount: number | null;
  driverPaymentAmount: number | null;
  driverPaymentMethods: string[];
  paymentFlagNotPaid: boolean;
  payments?: Payment[];
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  notes: string | null;
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

interface EmbeddedImage {
  name: string;
  base64: string | null;
}

async function generatePDFWithRetry(
  stop: Stop,
  embeddedImages: Array<{ name: string; base64: string | null }>,
  returns: ReturnItem[],
  baseUrl?: string,
  attempt: number = 1
): Promise<Buffer> {
  let browser;
  let page;

  try {
    console.log(`📄 PDF generation attempt ${attempt}/3...`);
    console.log(`📄 Launching Puppeteer browser...`);

    browser = await puppeteer.launch({
      headless: true, // Use stable headless mode
      timeout: 60000, // 1 minute timeout for browser launch
      protocolTimeout: 60000, // Protocol timeout
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain'
      ]
    });

    console.log(`📄 Creating new page...`);
    page = await browser.newPage();

    // Set longer timeouts for large images
    page.setDefaultTimeout(180000); // 3 minutes
    page.setDefaultNavigationTimeout(180000); // 3 minutes

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });

    console.log(`📄 Generating HTML content...`);
    const htmlContent = createHTMLTemplate(stop, embeddedImages, returns, baseUrl);

    console.log(`📄 Setting page content...`);
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 60000 // 1 minute for content loading
    });

    // Wait for images to load - longer timeout for large images
    console.log(`📄 Waiting for images to load...`);
    await page.waitForTimeout(5000); // 5 seconds for image loading

    console.log(`📄 Generating PDF...`);
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      timeout: 120000, // 2 minutes for PDF generation
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });

    console.log(`✅ PDF generated successfully with ${embeddedImages.filter(img => img.base64).length} embedded images`);

    return Buffer.from(pdfBuffer);

  } catch (error) {
    console.error(`❌ PDF generation attempt ${attempt} failed:`, error);

    // If this is not the last attempt and it's a connection error, retry
    if (attempt < 3 && (
      (error instanceof Error && error.message.includes('socket hang up')) ||
      (error instanceof Error && error.message.includes('ECONNRESET')) ||
      (error instanceof Error && error.message.includes('Target closed'))
    )) {
      console.log(`🔄 Retrying PDF generation (attempt ${attempt + 1}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      return generatePDFWithRetry(stop, embeddedImages, returns, baseUrl, attempt + 1);
    }

    // Provide more specific error messages
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;

      // Handle specific Puppeteer errors
      if (error.message.includes('socket hang up') || error.message.includes('ECONNRESET')) {
        errorMessage = 'Browser connection failed after 3 attempts. This may be due to system resource constraints.';
      } else if (error.message.includes('Navigation timeout')) {
        errorMessage = 'PDF generation timed out. The images may be too large or the system is under heavy load.';
      } else if (error.message.includes('Target closed')) {
        errorMessage = 'Browser process was terminated unexpectedly after 3 attempts.';
      }
    }

    throw new Error(`PDF generation failed: ${errorMessage}`);
  } finally {
    // Ensure cleanup happens even if there's an error
    try {
      if (page) {
        console.log(`📄 Closing page...`);
        await page.close();
      }
    } catch (closeError) {
      console.warn(`⚠️ Error closing page:`, closeError);
    }

    try {
      if (browser) {
        console.log(`📄 Closing browser...`);
        await browser.close();
      }
    } catch (closeError) {
      console.warn(`⚠️ Error closing browser:`, closeError);
    }
  }
}

export async function generateDeliveryPDF(
  stop: Stop,
  imageUrls: ImageUrl[],
  returns: ReturnItem[],
  baseUrl?: string
): Promise<Buffer> {
  console.log(`📄 Starting PDF generation for stop ${stop.id} with ${imageUrls.length} images...`);

  try {
    // Convert image URLs to embedded images for the HTML template
    const embeddedImages: EmbeddedImage[] = [];

    for (const imageUrl of imageUrls) {
      const base64 = await imageToBase64(imageUrl.url);
      embeddedImages.push({
        name: imageUrl.name,
        base64: base64
      });
    }

    // Use the HTML template with Puppeteer for the clean design
    return await generatePDFWithRetry(stop, embeddedImages, returns, baseUrl);

  } catch (error) {
    console.error(`❌ PDF generation failed:`, error);
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}



function createHTMLTemplate(stop: Stop, embeddedImages: EmbeddedImage[], returns: ReturnItem[], baseUrl?: string): string {
  // Use provided baseUrl or fallback to production domain
  const finalBaseUrl = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://delivery.brfood.us';

  console.log(`📄 PDF Generator - Using base URL: ${finalBaseUrl}`);

  // Calculate payment information
  const totalPaymentAmount = stop.driverPaymentAmount || 0;
  const invoiceNumber = stop.quickbooksInvoiceNum || 'N/A';
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
      line-height: 1.6;
      color: #000000;
      background: #ffffff;
      font-size: 14px;
      padding: 40px 20px;
    }

    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border: 1px solid #000000;
      padding: 40px;
    }

    .customer-name {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 20px;
      color: #000000;
    }

    .thank-you-message {
      text-align: center;
      margin-bottom: 40px;
      color: #000000;
      line-height: 1.5;
    }
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

    .payment-amount {
      font-size: 18px;
      font-weight: bold;
      color: #000000;
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

    .embedded-images {
      background: #ffffff;
      padding: 20px;
      margin-bottom: 20px;
      text-align: center;
    }

    .images-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }

    .image-container {
      text-align: center;
    }

    .embedded-image {
      max-width: 100%;
      max-height: 200px;
      width: auto;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .image-caption {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      font-weight: bold;
    }

    /* Print optimization */
    @media print {
      body { -webkit-print-color-adjust: exact; }
      .container { padding: 10mm; }
      .embedded-image { max-height: 150px; }
    }

  </style>
</head>
<body>
  <div class="container">
    <!-- Customer Name -->
    <div class="customer-name">${stop.customerName}</div>

    <!-- Thank You Message -->
    <div class="thank-you-message">
      Thank you for being a loyal customer.<br><br>
      Please review attached documents, including today's invoice, credit memo, and any other delivery related document.
    </div>

    <!-- Invoice Section -->
    <div class="invoice-section">
      <div class="invoice-number">INVOICE # ${invoiceNumber}</div>
      <div class="total-amount">TOTAL AMOUNT: $${totalAmount.toFixed(2)}</div>
    </div>

    <!-- Company Signature -->
    <div class="company-signature">
      Thank you,<br>
      <strong>B&R Food Services</strong>
    </div>

    <!-- Payment Section -->
    <div class="payment-section">
      <div class="payment-received">Payment received at the time of the delivery</div>
      <div class="payment-amount">$${totalPaymentAmount.toFixed(2)}</div>
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

    <!-- Embedded Images Section -->
    ${embeddedImages.filter(img => img.base64).length > 0 ? `
    <div class="embedded-images">
      <div style="margin-bottom: 15px; font-weight: bold; text-align: center;">📄 Delivery Invoice Images</div>
      <div class="images-grid">
        ${embeddedImages.filter(img => img.base64).map((img, index) => `
          <div class="image-container">
            <img src="${img.base64}" alt="${img.name}" class="embedded-image" />
            <div class="image-caption">Image ${index + 1}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Footer Section -->
    <div class="footer-section">
      <div class="footer-contact">
        24/7 customer service | (323) 366-0887 | customer.services@brfood.us
      </div>
    </div>
  </div>
</body>
</html>`;
}
