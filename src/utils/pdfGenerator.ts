import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';


// Function to compress image using Sharp
async function compressImage(inputPath: string, maxSizeKB: number = 500): Promise<Buffer> {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`📄 Compressing image: ${path.basename(inputPath)} (${metadata.width}x${metadata.height})`);

    // Start with quality 85 for JPEG compression
    let quality = 85;
    let compressedBuffer: Buffer;

    // Resize if image is very large (over 2000px width)
    let resizeWidth = metadata.width;
    if (metadata.width && metadata.width > 2000) {
      resizeWidth = 1600; // Resize to 1600px width max
      console.log(`📄 Resizing image from ${metadata.width}px to ${resizeWidth}px width`);
    }

    do {
      compressedBuffer = await image
        .resize(resizeWidth, null, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({
          quality: quality,
          progressive: true,
          mozjpeg: true // Use mozjpeg for better compression
        })
        .toBuffer();

      const compressedSizeKB = compressedBuffer.length / 1024;
      console.log(`📄 Compression attempt: quality ${quality}, size ${compressedSizeKB.toFixed(1)}KB`);

      // If size is acceptable or quality is too low, break
      if (compressedSizeKB <= maxSizeKB || quality <= 30) {
        break;
      }

      // Reduce quality for next attempt
      quality -= 10;
    } while (quality > 30);

    const finalSizeKB = (compressedBuffer.length / 1024).toFixed(1);
    const originalSizeKB = ((await fs.stat(inputPath)).size / 1024).toFixed(1);
    const compressionRatio = ((1 - compressedBuffer.length / (await fs.stat(inputPath)).size) * 100).toFixed(1);

    console.log(`✅ Image compressed: ${originalSizeKB}KB → ${finalSizeKB}KB (${compressionRatio}% reduction)`);

    return compressedBuffer;
  } catch (error) {
    console.error(`❌ Error compressing image: ${inputPath}`, error);
    // Fallback to original image
    return await fs.readFile(inputPath);
  }
}

// Function to convert image to base64 with smart compression
async function imageToBase64(imagePath: string, forceCompress: boolean = false): Promise<string | null> {
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
    const originalSizeKB = stats.size / 1024;

    let imageBuffer: Buffer;
    let mimeType = 'image/jpeg'; // Default to JPEG after compression

    // Compress if image is large (>500KB) or compression is forced
    if (originalSizeKB > 500 || forceCompress) {
      console.log(`📄 Compressing large image: ${imagePath} (${originalSizeKB.toFixed(1)}KB)`);
      imageBuffer = await compressImage(fullPath, 400); // Target 400KB max
      mimeType = 'image/jpeg'; // Compressed images are always JPEG
    } else {
      // Use original image for small files
      imageBuffer = await fs.readFile(fullPath);

      // Determine original MIME type
      const ext = path.extname(imagePath).toLowerCase();
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';
      else mimeType = 'image/jpeg';

      console.log(`📄 Using original image: ${imagePath} (${originalSizeKB.toFixed(1)}KB)`);
    }

    const base64 = imageBuffer.toString('base64');
    const finalSizeKB = (imageBuffer.length / 1024).toFixed(1);

    console.log(`📄 Image ready for PDF: ${imagePath} (${finalSizeKB}KB base64)`);

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
  url?: string; // Optional URL for link-based display
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
        '--use-mock-keychain',
        // Increased memory limits for 30+ images
        '--max-old-space-size=4096',
        '--max_old_space_size=4096'
      ]
    });

    console.log(`📄 Creating new page...`);
    page = await browser.newPage();

    // Set longer timeouts for large images (increased for 30+ images)
    page.setDefaultTimeout(600000); // 10 minutes
    page.setDefaultNavigationTimeout(600000); // 10 minutes

    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 1600 });

    console.log(`📄 Generating HTML content...`);
    const htmlContent = createHTMLTemplate(stop, embeddedImages, returns, baseUrl);

    console.log(`📄 Setting page content...`);
    await page.setContent(htmlContent, {
      waitUntil: 'domcontentloaded',
      timeout: 300000 // 5 minutes for content loading
    });

    // Wait for images to load - much longer timeout for 30+ images
    console.log(`📄 Waiting for images to load...`);
    const imageLoadTimeout = Math.max(30000, embeddedImages.length * 2000); // 2 seconds per image, minimum 30 seconds
    console.log(`📄 Using ${imageLoadTimeout}ms timeout for ${embeddedImages.length} images`);
    await page.waitForTimeout(imageLoadTimeout);

    console.log(`📄 Generating PDF...`);
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      timeout: 600000, // 10 minutes for PDF generation (increased for 30+ images)
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
    // Always embed all images for archival purposes
    console.log(`📄 Converting ${imageUrls.length} images to base64 for embedding...`);

    // Determine if we should compress images (for large batches)
    const shouldCompress = imageUrls.length >= 15; // Compress for 15+ images
    if (shouldCompress) {
      console.log(`📄 Large batch detected (${imageUrls.length} images) - enabling compression`);
    }

    // Process images in batches to avoid memory overload
    const batchSize = 5; // Process 5 images at a time
    const embeddedImages: EmbeddedImage[] = [];

    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize);
      console.log(`📄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(imageUrls.length/batchSize)} (${batch.length} images)`);

      // Process batch in parallel for speed
      const batchPromises = batch.map(async (imageUrl) => {
        const base64 = await imageToBase64(imageUrl.url, shouldCompress);
        return {
          name: imageUrl.name,
          base64: base64
        };
      });

      const batchResults = await Promise.all(batchPromises);
      embeddedImages.push(...batchResults);

      // Small delay between batches to prevent memory spikes and allow garbage collection
      if (i + batchSize < imageUrls.length) {
        console.log(`📄 Batch completed. Pausing for memory management...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay for GC

        // Force garbage collection if available (Node.js with --expose-gc flag)
        if (global.gc) {
          global.gc();
          console.log(`📄 Garbage collection triggered`);
        }
      }
    }

    const successfulImages = embeddedImages.filter(img => img.base64).length;
    console.log(`📄 Successfully converted ${successfulImages}/${imageUrls.length} images`);

    if (shouldCompress) {
      console.log(`📄 Compression enabled for large batch - images optimized for PDF embedding`);
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

    .footer-contact a {
      color: white;
      text-decoration: underline;
    }

    .footer-contact a:hover {
      color: #f0f0f0;
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
      max-height: 300px; /* Increased for better quality but still manageable */
      width: auto;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      object-fit: contain; /* Maintain aspect ratio */
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
      .embedded-image { max-height: 250px; } /* Optimized for print */
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
        24/7 customer service | <a href="tel:+13233660887">(323) 366-0887</a> | <a href="mailto:customer.services@brfood.us">customer.services@brfood.us</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}
