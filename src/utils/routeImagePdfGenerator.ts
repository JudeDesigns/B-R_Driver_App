import { PDFDocument, rgb, StandardFonts, PDFImage } from 'pdf-lib';
import { promises as fs } from 'fs';
import * as path from 'path';

// Interface for route data structure
interface RouteImagePdfData {
  route: {
    id: string;
    routeNumber: string | null;
    date: string;
  };
  stopsGroupedByDriver: Record<string, Array<{
    id: string;
    sequence: number;
    customer: {
      name: string;
    };
    invoiceImageUrls: string[];
  }>>;
  totalDrivers: number;
  totalStops: number;
  totalImages: number;
}

/**
 * Generate a professional PDF report with embedded images for a route
 * Replaces the ZIP archive functionality with a single PDF document
 */
export async function generateRouteImagePDF(
  routeData: RouteImagePdfData,
  baseUrl: string
): Promise<Buffer> {
  console.log(`📄 Creating PDF report for route ${routeData.route.routeNumber}`);
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Page dimensions (A4)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const contentWidth = pageWidth - (margin * 2);
  
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - margin;
  
  // Helper function to add a new page when needed
  const addNewPageIfNeeded = (requiredHeight: number) => {
    if (yPosition - requiredHeight < margin) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      yPosition = pageHeight - margin;
      return true;
    }
    return false;
  };
  
  // Helper function to draw text
  const drawText = (text: string, x: number, y: number, options: {
    font?: any;
    size?: number;
    color?: any;
    maxWidth?: number;
  } = {}) => {
    const font = options.font || helveticaFont;
    const size = options.size || 12;
    const color = options.color || rgb(0, 0, 0);
    
    currentPage.drawText(text, {
      x,
      y,
      size,
      font,
      color,
      maxWidth: options.maxWidth || contentWidth
    });
  };
  
  // Draw PDF header
  const routeDate = new Date(routeData.route.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  drawText(`Route ${routeData.route.routeNumber || 'Unknown'}`, margin, yPosition, {
    font: helveticaBoldFont,
    size: 24,
    color: rgb(0.2, 0.2, 0.2)
  });
  yPosition -= 40;
  
  drawText(`Date: ${routeDate}`, margin, yPosition, {
    font: helveticaFont,
    size: 14,
    color: rgb(0.4, 0.4, 0.4)
  });
  yPosition -= 20;
  
  drawText(`${routeData.totalDrivers} Drivers • ${routeData.totalStops} Stops • ${routeData.totalImages} Images`, margin, yPosition, {
    font: helveticaFont,
    size: 12,
    color: rgb(0.5, 0.5, 0.5)
  });
  yPosition -= 40;
  
  // Draw a separator line
  currentPage.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });
  yPosition -= 30;
  
  // Process each driver section
  for (const [driverName, stops] of Object.entries(routeData.stopsGroupedByDriver)) {
    // Check if we need a new page for the driver section
    addNewPageIfNeeded(60);
    
    // Driver section header
    drawText(`Driver: ${driverName}`, margin, yPosition, {
      font: helveticaBoldFont,
      size: 16,
      color: rgb(0.1, 0.3, 0.6)
    });
    yPosition -= 30;
    
    // Process each stop for this driver
    for (const stop of stops) {
      // Check if we need a new page for the stop
      addNewPageIfNeeded(40);
      
      // Stop header
      drawText(`Stop ${stop.sequence}: ${stop.customer.name}`, margin + 20, yPosition, {
        font: helveticaBoldFont,
        size: 14,
        color: rgb(0.2, 0.2, 0.2)
      });
      yPosition -= 25;
      
      // Process images for this stop
      if (stop.invoiceImageUrls && stop.invoiceImageUrls.length > 0) {
        console.log(`Processing ${stop.invoiceImageUrls.length} images for stop ${stop.sequence}`);
        
        // Process images in 2x2 grid layout
        const imagesPerRow = 2;
        const rowsPerGrid = 2;
        const imagesPerGrid = imagesPerRow * rowsPerGrid; // 4 images per grid

        for (let gridStart = 0; gridStart < stop.invoiceImageUrls.length; gridStart += imagesPerGrid) {
          const gridImages = stop.invoiceImageUrls.slice(gridStart, gridStart + imagesPerGrid);
          const embeddedImages: { image: PDFImage; width: number; height: number; url: string; index: number }[] = [];

          // Load and process images for this 2x2 grid
          for (let i = 0; i < gridImages.length; i++) {
            const imageUrl = gridImages[i];
            const globalIndex = gridStart + i;

            try {
              // Load and embed the image
              const imagePath = path.join(process.cwd(), "public", imageUrl);
              const imageBuffer = await fs.readFile(imagePath);

              // Validate image buffer
              if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error("Empty image file");
              }

              let embeddedImage: PDFImage;

              // Detect actual file format by examining file header, not extension
              const isPNG = imageBuffer.length >= 8 &&
                           imageBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
              const isJPEG = imageBuffer.length >= 2 &&
                            imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8;

              if (isPNG) {
                embeddedImage = await pdfDoc.embedPng(imageBuffer);
              } else if (isJPEG) {
                embeddedImage = await pdfDoc.embedJpg(imageBuffer);
              } else {
                const imageExtension = path.extname(imageUrl).toLowerCase();
                throw new Error(`Unsupported or corrupted image format. Extension: ${imageExtension}, First bytes: ${imageBuffer.subarray(0, 4).toString('hex')}`);
              }

              // Calculate smaller image dimensions for 2x2 grid layout
              const gridSpacing = 15;
              const maxImageWidth = Math.min(140, (contentWidth - 80 - gridSpacing) / 2); // Fit 2 images per row with spacing
              const maxImageHeight = 110; // Smaller height for grid layout

              const imageAspectRatio = embeddedImage.width / embeddedImage.height;
              let imageWidth = Math.min(maxImageWidth, embeddedImage.width * 0.15); // Scale down to 15% of original
              let imageHeight = imageWidth / imageAspectRatio;

              if (imageHeight > maxImageHeight) {
                imageHeight = maxImageHeight;
                imageWidth = imageHeight * imageAspectRatio;
              }

              embeddedImages.push({
                image: embeddedImage,
                width: imageWidth,
                height: imageHeight,
                url: imageUrl,
                index: globalIndex + 1
              });

              console.log(`✅ Loaded image ${globalIndex + 1} for 2x2 grid`);

            } catch (error) {
              console.warn(`Failed to load image ${imageUrl}:`, error);
              // Skip failed images but continue with grid
            }
          }

          if (embeddedImages.length > 0) {
            // Calculate grid dimensions
            const gridSpacing = 15;
            const maxImageWidth = Math.min(140, (contentWidth - 80 - gridSpacing) / 2);
            const maxImageHeight = 110;
            const gridHeight = (maxImageHeight * 2) + gridSpacing + 40; // 2 rows + spacing + labels

            // Check if we need a new page for this grid
            addNewPageIfNeeded(gridHeight);

            // Draw images in 2x2 grid
            const startX = margin + 40;
            const startY = yPosition;

            embeddedImages.forEach((imgData, index) => {
              const row = Math.floor(index / imagesPerRow);
              const col = index % imagesPerRow;

              const x = startX + col * (maxImageWidth + gridSpacing);
              const y = startY - (row * (maxImageHeight + gridSpacing + 20));

              // Draw image label
              drawText(`Image ${imgData.index}:`, x, y, {
                font: helveticaFont,
                size: 9,
                color: rgb(0.5, 0.5, 0.5)
              });

              // Draw the image
              currentPage.drawImage(imgData.image, {
                x: x,
                y: y - 15 - imgData.height,
                width: imgData.width,
                height: imgData.height
              });

              console.log(`✅ Embedded image ${imgData.index} in 2x2 grid at position (${row}, ${col})`);
            });

            yPosition -= gridHeight;
          }
        }
      } else {
        // No images for this stop
        drawText('No images uploaded', margin + 40, yPosition, {
          font: helveticaFont,
          size: 10,
          color: rgb(0.6, 0.6, 0.6)
        });
        yPosition -= 20;
      }
      
      yPosition -= 10; // Extra space between stops
    }
    
    yPosition -= 20; // Extra space between drivers
  }
  
  // Generate the PDF buffer
  const pdfBuffer = await pdfDoc.save();
  
  console.log(`✅ PDF generated successfully: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  
  return Buffer.from(pdfBuffer);
}
