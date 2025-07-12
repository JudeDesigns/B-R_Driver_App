import puppeteer from 'puppeteer';

interface Stop {
  id: string;
  sequence: number;
  invoiceImageUrls: string[];
  customer: {
    id: string;
    name: string;
  };
}

interface RouteImageReportData {
  route: {
    id: string;
    routeNumber: string;
    date: Date;
  };
  stopsGroupedByDriver: Record<string, Stop[]>;
  totalDrivers: number;
  totalStops: number;
  totalImages: number;
}

export async function generateRouteImageReportPDF(
  reportData: RouteImageReportData,
  baseUrl: string
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
    
    const htmlContent = createRouteImageReportHTML(reportData, baseUrl);
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    // Wait a bit for images to load, but don't wait indefinitely
    await page.waitForTimeout(2000);
    
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

function createRouteImageReportHTML(reportData: RouteImageReportData, baseUrl: string): string {
  const { route, stopsGroupedByDriver, totalDrivers, totalStops, totalImages } = reportData;
  
  // Format date
  const routeDate = new Date(route.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create driver sections
  const driverSections = Object.entries(stopsGroupedByDriver).map(([driverName, stops]) => {
    // Collect all images for this driver
    const allImages: Array<{ url: string; customerName: string; stopSequence: number }> = [];
    
    stops.forEach(stop => {
      stop.invoiceImageUrls.forEach(imageUrl => {
        allImages.push({
          url: imageUrl,
          customerName: stop.customer.name,
          stopSequence: stop.sequence
        });
      });
    });

    // Create image grids (4x4 = 16 images per page)
    const imageGrids = [];
    for (let i = 0; i < allImages.length; i += 16) {
      const gridImages = allImages.slice(i, i + 16);
      imageGrids.push(createImageGrid(gridImages, baseUrl));
    }

    const driverStopCount = stops.length;
    const driverImageCount = allImages.length;

    return `
      <div class="driver-section">
        <div class="driver-header">
          <h2>👤 Driver: ${driverName}</h2>
          <div class="driver-summary">
            ${driverStopCount} stop${driverStopCount !== 1 ? 's' : ''} • ${driverImageCount} image${driverImageCount !== 1 ? 's' : ''}
          </div>
        </div>
        ${imageGrids.join('')}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Route ${route.routeNumber} - Image Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.4;
      color: #333;
      background: white;
    }

    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      border-bottom: 2px solid #000;
    }

    .header h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .header .date {
      font-size: 16px;
      color: #666;
      margin-bottom: 15px;
    }

    .header .summary {
      font-size: 14px;
      color: #444;
      background: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      display: inline-block;
    }

    .driver-section {
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .driver-header {
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-left: 4px solid #007bff;
    }

    .driver-header h2 {
      font-size: 18px;
      margin-bottom: 5px;
    }

    .driver-summary {
      font-size: 14px;
      color: #666;
    }

    .image-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }

    .image-item {
      text-align: center;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 10px;
      background: white;
    }

    .image-item img {
      width: 100%;
      height: 150px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .image-label {
      font-size: 12px;
      color: #555;
      font-weight: 500;
      word-wrap: break-word;
    }

    .page-break {
      page-break-before: always;
    }

    @media print {
      .driver-section {
        page-break-inside: avoid;
      }
      
      .image-grid {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📄 Route ${route.routeNumber} - Image Report</h1>
    <div class="date">📅 ${routeDate}</div>
    <div class="summary">
      ${totalDrivers} driver${totalDrivers !== 1 ? 's' : ''} • ${totalStops} stop${totalStops !== 1 ? 's' : ''} • ${totalImages} image${totalImages !== 1 ? 's' : ''}
    </div>
  </div>

  ${driverSections}
</body>
</html>`;
}

function createImageGrid(images: Array<{ url: string; customerName: string; stopSequence: number }>, baseUrl: string): string {
  // Fill empty slots to complete the 4x4 grid
  const gridImages = [...images];
  while (gridImages.length % 16 !== 0 && gridImages.length % 4 !== 0) {
    gridImages.push({ url: '', customerName: '', stopSequence: 0 });
  }

  const imageItems = gridImages.map(image => {
    if (!image.url) {
      return '<div class="image-item" style="visibility: hidden;"></div>';
    }

    const fullImageUrl = image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}`;
    
    return `
      <div class="image-item">
        <img src="${fullImageUrl}" alt="Stop ${image.stopSequence} - ${image.customerName}" />
        <div class="image-label">${image.customerName}</div>
      </div>
    `;
  }).join('');

  return `<div class="image-grid">${imageItems}</div>`;
}
