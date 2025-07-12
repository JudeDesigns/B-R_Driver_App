import JSZip from 'jszip';
import { promises as fs } from 'fs';
import path from 'path';

interface Stop {
  id: string;
  sequence: number;
  invoiceImageUrls: string[];
  customer: {
    id: string;
    name: string;
  };
}

interface RouteImageArchiveData {
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

export async function generateRouteImageArchiveZIP(
  archiveData: RouteImageArchiveData,
  baseUrl: string
): Promise<Buffer> {
  const zip = new JSZip();
  
  console.log(`📦 Creating ZIP archive for route ${archiveData.route.routeNumber}`);
  
  // Create the HTML report
  const htmlContent = createRouteImageReportHTML(archiveData);
  zip.file("route-report.html", htmlContent);
  
  // Create README file
  const readmeContent = createReadmeContent(archiveData);
  zip.file("README.txt", readmeContent);
  
  // Create images folder
  const imagesFolder = zip.folder("images");
  
  if (!imagesFolder) {
    throw new Error("Failed to create images folder in ZIP");
  }
  
  // Add all images to the ZIP
  let imageCount = 0;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  
  for (const [driverName, stops] of Object.entries(archiveData.stopsGroupedByDriver)) {
    console.log(`📁 Processing images for driver: ${driverName}`);
    
    for (const stop of stops) {
      for (let i = 0; i < stop.invoiceImageUrls.length; i++) {
        const imageUrl = stop.invoiceImageUrls[i];
        const imagePath = path.join(uploadsDir, imageUrl.replace('/uploads/', ''));
        
        try {
          // Read the image file
          const imageBuffer = await fs.readFile(imagePath);
          
          // Create a clean filename
          const originalFilename = path.basename(imagePath);
          const cleanFilename = `stop${stop.sequence}_${stop.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_img${i + 1}_${originalFilename}`;
          
          // Add to ZIP
          imagesFolder.file(cleanFilename, imageBuffer);
          imageCount++;
          
          console.log(`📷 Added image: ${cleanFilename}`);
        } catch (error) {
          console.warn(`⚠️ Failed to read image ${imagePath}:`, error);
          // Continue with other images even if one fails
        }
      }
    }
  }
  
  console.log(`✅ Added ${imageCount} images to ZIP archive`);
  
  // Generate the ZIP buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: {
      level: 6 // Good balance between size and speed
    }
  });
  
  console.log(`📦 ZIP archive generated: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  return zipBuffer;
}

function createRouteImageReportHTML(archiveData: RouteImageArchiveData): string {
  const { route, stopsGroupedByDriver, totalDrivers, totalStops, totalImages } = archiveData;
  
  // Format date
  const routeDate = new Date(route.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create driver sections
  const driverSections = Object.entries(stopsGroupedByDriver).map(([driverName, stops]) => {
    // Collect all images for this driver
    const allImages: Array<{ filename: string; customerName: string; stopSequence: number }> = [];
    
    stops.forEach(stop => {
      stop.invoiceImageUrls.forEach((imageUrl, index) => {
        const originalFilename = path.basename(imageUrl);
        const cleanFilename = `stop${stop.sequence}_${stop.customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_img${index + 1}_${originalFilename}`;
        
        allImages.push({
          filename: cleanFilename,
          customerName: stop.customer.name,
          stopSequence: stop.sequence
        });
      });
    });

    // Create image grids (4x4 = 16 images per section)
    const imageGrids = [];
    for (let i = 0; i < allImages.length; i += 16) {
      const gridImages = allImages.slice(i, i + 16);
      imageGrids.push(createImageGrid(gridImages));
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
  <title>Route ${route.routeNumber} - Image Archive</title>
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
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
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

    .archive-note {
      background: #e8f5e8;
      border: 1px solid #4caf50;
      border-radius: 5px;
      padding: 15px;
      margin-bottom: 20px;
      color: #2e7d32;
    }

    .driver-section {
      margin-bottom: 40px;
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
      cursor: pointer;
      transition: transform 0.2s;
    }

    .image-item img:hover {
      transform: scale(1.05);
    }

    .image-label {
      font-size: 12px;
      color: #555;
      font-weight: 500;
      word-wrap: break-word;
      margin-bottom: 5px;
    }

    .download-link {
      font-size: 11px;
      color: #007bff;
      text-decoration: none;
      padding: 2px 6px;
      border: 1px solid #007bff;
      border-radius: 3px;
      display: inline-block;
    }

    .download-link:hover {
      background: #007bff;
      color: white;
    }

    @media (max-width: 768px) {
      .image-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="archive-note">
    <strong>📁 Route Image Archive</strong><br>
    This is an offline archive of all delivery images for this route. All images are stored in the "images" folder and can be downloaded individually by clicking the download links below each image.
  </div>

  <div class="header">
    <h1>📄 Route ${route.routeNumber} - Image Archive</h1>
    <div class="date">📅 ${routeDate}</div>
    <div class="summary">
      ${totalDrivers} driver${totalDrivers !== 1 ? 's' : ''} • ${totalStops} stop${totalStops !== 1 ? 's' : ''} • ${totalImages} image${totalImages !== 1 ? 's' : ''}
    </div>
  </div>

  ${driverSections}
</body>
</html>`;
}

function createImageGrid(images: Array<{ filename: string; customerName: string; stopSequence: number }>): string {
  // Fill empty slots to complete the 4x4 grid
  const gridImages = [...images];
  while (gridImages.length % 16 !== 0 && gridImages.length % 4 !== 0) {
    gridImages.push({ filename: '', customerName: '', stopSequence: 0 });
  }

  const imageItems = gridImages.map(image => {
    if (!image.filename) {
      return '<div class="image-item" style="visibility: hidden;"></div>';
    }

    return `
      <div class="image-item">
        <img src="images/${image.filename}" alt="Stop ${image.stopSequence} - ${image.customerName}" onclick="window.open('images/${image.filename}', '_blank')" />
        <div class="image-label">${image.customerName}</div>
        <a href="images/${image.filename}" download="${image.filename}" class="download-link">Download</a>
      </div>
    `;
  }).join('');

  return `<div class="image-grid">${imageItems}</div>`;
}

function createReadmeContent(archiveData: RouteImageArchiveData): string {
  const routeDate = new Date(archiveData.route.date).toLocaleDateString('en-US');
  
  return `
ROUTE IMAGE ARCHIVE
==================

Route: ${archiveData.route.routeNumber}
Date: ${routeDate}
Total Drivers: ${archiveData.totalDrivers}
Total Stops: ${archiveData.totalStops}
Total Images: ${archiveData.totalImages}

CONTENTS:
---------
- route-report.html: Main report with image gallery
- images/: Folder containing all delivery images
- README.txt: This file

INSTRUCTIONS:
-------------
1. Open "route-report.html" in any web browser
2. View images organized by driver and stop
3. Click images to view full size
4. Use download links to save individual images
5. All images are also available in the "images" folder

ARCHIVE CREATED: ${new Date().toLocaleString()}

This archive is self-contained and can be viewed offline.
All images are preserved in their original quality.
`;
}
