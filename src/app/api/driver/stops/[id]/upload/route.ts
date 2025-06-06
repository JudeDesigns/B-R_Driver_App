import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { emitStopStatusUpdate } from "@/app/api/socketio/route";

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);
const readdirAsync = promisify(fs.readdir);
const readFileAsync = promisify(fs.readFile);

// Helper function to calculate image size while maintaining aspect ratio
function calculateImageSize(image: any, maxWidth: number, maxHeight: number) {
  const aspectRatio = image.width / image.height;

  let width = image.width;
  let height = image.height;

  // Scale down if too wide
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  // Scale down if too tall
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width, height };
}

// POST /api/driver/stops/[id]/upload - Upload an invoice image and convert to PDF
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // In Next.js 14, params is a Promise that needs to be awaited
    const params = await context.params;
    const { id } = params;
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // We already extracted the ID from context.params above
    // const { id } = params;

    // Check if the stop exists and belongs to a route assigned to the driver
    const stop = await prisma.stop.findFirst({
      where: {
        id,
        isDeleted: false,
        route: {
          OR: [
            { driverId: decoded.id },
            {
              stops: {
                some: {
                  driverNameFromUpload: {
                    equals: decoded.username,
                  },
                },
              },
            },
          ],
          isDeleted: false,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
            address: true,
          },
        },
        route: {
          select: {
            routeNumber: true,
            date: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Process the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file uploaded" },
        { status: 400 }
      );
    }

    // Get image metadata for multiple image handling
    const imageIndex = parseInt(formData.get('imageIndex') as string || '0');
    const totalImages = parseInt(formData.get('totalImages') as string || '1');
    const sessionId = formData.get('sessionId') as string || Math.random().toString(36).substring(2, 15);

    // Check file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Read the file as an ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Create a unique filename with session ID for grouping
    const timestamp = new Date().getTime();
    const fileName = `invoice_${stop.id}_${timestamp}_${sessionId}_img${imageIndex + 1}`;

    // Ensure the uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const pdfDir = path.join(uploadsDir, "pdf");

    if (!(await existsAsync(uploadsDir))) {
      await mkdirAsync(uploadsDir, { recursive: true });
    }

    if (!(await existsAsync(pdfDir))) {
      await mkdirAsync(pdfDir, { recursive: true });
    }

    // Save the original image
    const imageFilePath = path.join(uploadsDir, `${fileName}.jpg`);
    await writeFileAsync(imageFilePath, Buffer.from(fileBuffer));

    // Get returns for this stop
    const returns = await prisma.return.findMany({
      where: {
        stopId: stop.id,
        isDeleted: false,
      },
      include: {
        product: true,
      },
    });

    // REFACTORED PDF GENERATION - Clean and Simple Approach
    console.log(`=== PDF GENERATION START ===`);
    console.log(`Processing image ${imageIndex + 1} of ${totalImages} for stop ${stop.id}`);

    // Only generate PDF on the LAST image upload
    if (imageIndex < totalImages - 1) {
      console.log(`Saving image ${imageIndex + 1}, waiting for remaining images...`);
      return NextResponse.json({
        message: `Image ${imageIndex + 1} of ${totalImages} uploaded successfully. Waiting for remaining images.`,
        imageIndex: imageIndex + 1,
        totalImages: totalImages,
        isComplete: false
      });
    }

    console.log(`Last image received. Generating PDF with all ${totalImages} images...`);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();

    // FIXED: Collect ALL images from current upload session
    const allImages = [];

    // Get all images from this upload session (based on sessionId pattern)
    const sessionPattern = new RegExp(`invoice_${stop.id}_\\d+_${sessionId}_img\\d+\\.jpg$`);

    try {
      const files = await readdirAsync(uploadsDir);
      console.log(`Scanning for current session images with sessionId: ${sessionId}`);

      for (const file of files) {
        if (sessionPattern.test(file)) {
          const imagePath = path.join(uploadsDir, file);
          const imageBuffer = await readFileAsync(imagePath);
          const imageIndexMatch = file.match(/_img(\d+)\.jpg$/);
          const fileImageIndex = parseInt(imageIndexMatch?.[1] || '0');

          allImages.push({
            buffer: imageBuffer,
            index: fileImageIndex,
            name: file
          });
          console.log(`Found session image: ${file} (index: ${fileImageIndex})`);
        }
      }
    } catch (error) {
      console.error("Error reading session images:", error);
      // Fallback to current image only
      allImages.push({
        buffer: Buffer.from(fileBuffer),
        index: imageIndex + 1,
        name: `${fileName}.jpg`
      });
    }

    console.log(`Total session images found: ${allImages.length}`);

    // Sort by index
    allImages.sort((a, b) => a.index - b.index);
    console.log(`Total images to process: ${allImages.length}`);

    // Generate image URLs instead of embedding
    const imageUrls = allImages.map(img => ({
      url: `/uploads/${img.name}`,
      name: img.name,
      index: img.index
    }));

    console.log(`Generated ${imageUrls.length} image URLs:`, imageUrls.map(img => img.url));

    // Create first page with invoice details
    const firstPage = pdfDoc.addPage([612, 792]); // Letter size

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Define enhanced color palette
    const primaryColor = rgb(0.15, 0.15, 0.15); // Rich dark gray
    const secondaryColor = rgb(0.4, 0.4, 0.4); // Medium gray
    const accentColor = rgb(0.0, 0.3, 0.6); // Professional blue
    const successColor = rgb(0.0, 0.5, 0.2); // Green for completed items
    const warningColor = rgb(0.8, 0.4, 0.0); // Orange for attention items
    const lightGray = rgb(0.95, 0.95, 0.95); // Light background
    const borderColor = rgb(0.8, 0.8, 0.8); // Border color

    // Define dimensions
    const pageWidth = firstPage.getWidth();
    const pageHeight = firstPage.getHeight();
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Draw header background
    firstPage.drawRectangle({
      x: 0,
      y: pageHeight - 100,
      width: pageWidth,
      height: 100,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Draw header border
    firstPage.drawLine({
      start: { x: 0, y: pageHeight - 100 },
      end: { x: pageWidth, y: pageHeight - 100 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Add company name
    firstPage.drawText("B&R FOOD SERVICES", {
      x: margin,
      y: pageHeight - 40,
      size: 20,
      font: helveticaBold,
      color: accentColor,
    });

    // Add document title with enhanced styling
    firstPage.drawText("DELIVERY CONFIRMATION RECEIPT", {
      x: margin,
      y: pageHeight - 65,
      size: 16,
      font: helveticaBold,
      color: primaryColor,
    });

    // Add completion status badge (moved to avoid overlap with route info)
    const statusText = "COMPLETED";
    const statusWidth = helveticaBold.widthOfTextAtSize(statusText, 12);
    firstPage.drawRectangle({
      x: pageWidth - margin - statusWidth - 20,
      y: pageHeight - 25,
      width: statusWidth + 16,
      height: 18,
      color: successColor,
    });

    firstPage.drawText(statusText, {
      x: pageWidth - margin - statusWidth - 12,
      y: pageHeight - 20,
      size: 12,
      font: helveticaBold,
      color: rgb(1, 1, 1), // White text
    });

    // Add date on the right
    const dateText = `Date: ${new Date().toLocaleDateString()}`;
    const dateTextWidth = helvetica.widthOfTextAtSize(dateText, 10);
    firstPage.drawText(dateText, {
      x: pageWidth - margin - dateTextWidth,
      y: pageHeight - 40,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Add invoice number on the right
    const invoiceText = `Invoice #: ${stop.quickbooksInvoiceNum || "N/A"}`;
    const invoiceTextWidth = helvetica.widthOfTextAtSize(invoiceText, 10);
    firstPage.drawText(invoiceText, {
      x: pageWidth - margin - invoiceTextWidth,
      y: pageHeight - 55,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Add route number on the right
    const routeText = `Route #: ${stop.route.routeNumber || "N/A"}`;
    const routeTextWidth = helvetica.widthOfTextAtSize(routeText, 10);
    firstPage.drawText(routeText, {
      x: pageWidth - margin - routeTextWidth,
      y: pageHeight - 70,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Customer information section with enhanced design
    const customerSectionY = pageHeight - 140;

    // Draw customer section with modern styling
    firstPage.drawRectangle({
      x: margin,
      y: customerSectionY - 70,
      width: contentWidth,
      height: 70,
      color: lightGray,
      borderColor: borderColor,
      borderWidth: 1,
    });

    // Add left border accent
    firstPage.drawRectangle({
      x: margin,
      y: customerSectionY - 70,
      width: 4,
      height: 70,
      color: accentColor,
    });

    // Add customer section title with icon
    firstPage.drawText("CUSTOMER INFORMATION", {
      x: margin + 15,
      y: customerSectionY - 25,
      size: 11,
      font: helveticaBold,
      color: accentColor,
    });

    // Add customer details in two columns
    firstPage.drawText(`${stop.customer.name}`, {
      x: margin + 15,
      y: customerSectionY - 45,
      size: 11,
      font: helveticaBold,
      color: primaryColor,
    });

    firstPage.drawText(`${stop.customer.address}`, {
      x: margin + 15,
      y: customerSectionY - 60,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Add order information on the right side
    const orderInfo = stop.quickbooksInvoiceNum ? `Order #${stop.quickbooksInvoiceNum}` : "No Order #";
    const orderInfoWidth = helvetica.widthOfTextAtSize(orderInfo, 10);
    firstPage.drawText(orderInfo, {
      x: pageWidth - margin - orderInfoWidth - 15,
      y: customerSectionY - 45,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Delivery information section with enhanced design
    const deliverySectionY = customerSectionY - 90;

    // Draw delivery section with modern styling
    firstPage.drawRectangle({
      x: margin,
      y: deliverySectionY - 70,
      width: contentWidth,
      height: 70,
      color: rgb(0.95, 0.98, 0.95),
      borderColor: borderColor,
      borderWidth: 1,
    });

    // Add left border accent
    firstPage.drawRectangle({
      x: margin,
      y: deliverySectionY - 70,
      width: 4,
      height: 70,
      color: successColor,
    });

    // Add delivery section title with icon
    firstPage.drawText("DELIVERY SUMMARY", {
      x: margin + 15,
      y: deliverySectionY - 25,
      size: 11,
      font: helveticaBold,
      color: successColor,
    });

    // Format delivery date nicely
    const deliveryDate = new Date(stop.route.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    firstPage.drawText(`${deliveryDate}`, {
      x: margin + 15,
      y: deliverySectionY - 45,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Add completion time
    const completionTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    firstPage.drawText(`Completed at ${completionTime}`, {
      x: margin + 15,
      y: deliverySectionY - 60,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Add route information on the right side
    const routeInfo = `Route ${stop.route.routeNumber || 'N/A'}`;
    const routeInfoWidth = helvetica.widthOfTextAtSize(routeInfo, 10);
    firstPage.drawText(routeInfo, {
      x: pageWidth - margin - routeInfoWidth - 15,
      y: deliverySectionY - 45,
      size: 10,
      font: helveticaBold,
      color: accentColor,
    });

    // Returns section (if any returns exist)
    let returnsSectionY = deliverySectionY - 80;

    if (returns.length > 0) {
      // Calculate dynamic height based on content
      const headerHeight = 50;
      const itemHeight = 35; // Increased for better spacing
      const totalHeight = headerHeight + (returns.length * itemHeight) + 20;

      // Check if returns section will overflow the first page
      const maxAvailableHeight = returnsSectionY - 150; // Leave space for footer and images
      const willOverflow = totalHeight > maxAvailableHeight;

      if (willOverflow) {
        // If returns section is too large, limit items on first page and note continuation
        const maxItemsOnFirstPage = Math.floor((maxAvailableHeight - headerHeight - 20) / itemHeight);
        const actualHeight = headerHeight + (Math.min(returns.length, maxItemsOnFirstPage) * itemHeight) + 20;

        console.log(`Returns section overflow detected. Showing ${maxItemsOnFirstPage} of ${returns.length} items on first page.`);
      }

      // Calculate actual dimensions for the returns section
      const maxItemsOnFirstPage = willOverflow ?
        Math.floor((maxAvailableHeight - headerHeight - 20) / itemHeight) :
        returns.length;
      const actualHeight = headerHeight + (maxItemsOnFirstPage * itemHeight) + 20;

      // Draw returns section background with gradient effect
      firstPage.drawRectangle({
        x: margin,
        y: returnsSectionY - actualHeight,
        width: contentWidth,
        height: actualHeight,
        color: rgb(0.98, 0.95, 0.95),
        borderColor: rgb(0.85, 0.6, 0.6),
        borderWidth: 2,
      });

      // Add returns section title with enhanced styling and icon
      firstPage.drawText("RETURNED ITEMS", {
        x: margin + 15,
        y: returnsSectionY - 25,
        size: 12,
        font: helveticaBold,
        color: warningColor,
      });

      // Add summary info with truncation notice if needed
      const summaryText = willOverflow ?
        `Showing ${maxItemsOnFirstPage} of ${returns.length} items` :
        `Total Items Returned: ${returns.length}`;
      const summaryWidth = helvetica.widthOfTextAtSize(summaryText, 9);
      firstPage.drawText(summaryText, {
        x: pageWidth - margin - summaryWidth - 15,
        y: returnsSectionY - 25,
        size: 9,
        font: helvetica,
        color: willOverflow ? rgb(0.8, 0.4, 0.4) : rgb(0.5, 0.5, 0.5),
      });

      // Draw table header background
      firstPage.drawRectangle({
        x: margin + 10,
        y: returnsSectionY - 55,
        width: contentWidth - 20,
        height: 25,
        color: rgb(0.9, 0.85, 0.85),
        borderColor: rgb(0.8, 0.7, 0.7),
        borderWidth: 1,
      });

      // Enhanced table headers with better spacing and larger font
      firstPage.drawText("SKU", {
        x: margin + 15,
        y: returnsSectionY - 42,
        size: 10,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      firstPage.drawText("Product Name", {
        x: margin + 85,
        y: returnsSectionY - 42,
        size: 10,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      firstPage.drawText("Description", {
        x: margin + 200,
        y: returnsSectionY - 42,
        size: 10,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      firstPage.drawText("Qty", {
        x: margin + 320,
        y: returnsSectionY - 42,
        size: 10,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      firstPage.drawText("Reason", {
        x: margin + 360,
        y: returnsSectionY - 42,
        size: 10,
        font: helveticaBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Add return items with enhanced formatting (limited to what fits on first page)
      returns.slice(0, maxItemsOnFirstPage).forEach((returnItem, index) => {
        const itemY = returnsSectionY - 70 - (index * itemHeight);

        // Alternate row background for better readability
        if (index % 2 === 0) {
          firstPage.drawRectangle({
            x: margin + 10,
            y: itemY - 5,
            width: contentWidth - 20,
            height: itemHeight - 5,
            color: rgb(0.99, 0.99, 0.99),
          });
        }

        // Product SKU (fixed width: 70px)
        const productSku = returnItem.product?.sku || "N/A";
        const truncatedSku = productSku.length > 10 ? productSku.substring(0, 10) + "..." : productSku;
        firstPage.drawText(truncatedSku, {
          x: margin + 15,
          y: itemY + 10,
          size: 7,
          font: helvetica,
          color: rgb(0.2, 0.2, 0.2),
        });

        // Product Name (fixed width: 115px)
        const productName = returnItem.product?.name ||
                           returnItem.orderItemIdentifier ||
                           "Unknown Product";
        const maxNameLength = 15;
        const truncatedName = productName.length > maxNameLength
          ? productName.substring(0, maxNameLength) + "..."
          : productName;

        firstPage.drawText(truncatedName, {
          x: margin + 85,
          y: itemY + 10,
          size: 7,
          font: helveticaBold,
          color: primaryColor,
        });

        // Product Description (fixed width: 120px)
        const productDesc = returnItem.product?.description ||
                           returnItem.productDescription ||
                           "No description";
        const maxDescLength = 16;
        const truncatedDesc = productDesc.length > maxDescLength
          ? productDesc.substring(0, maxDescLength) + "..."
          : productDesc;

        firstPage.drawText(truncatedDesc, {
          x: margin + 200,
          y: itemY + 10,
          size: 7,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        });

        // Quantity with unit (fixed width: 40px)
        const unit = returnItem.product?.unit || "pcs";
        const quantityText = `${returnItem.quantity} ${unit}`;
        firstPage.drawText(quantityText, {
          x: margin + 320,
          y: itemY + 10,
          size: 7,
          font: helveticaBold,
          color: rgb(0.8, 0.3, 0.3),
        });

        // Reason (fixed width: remaining space) - Use actual reason text
        const reason = returnItem.reasonCode && returnItem.reasonCode !== "Driver return"
          ? returnItem.reasonCode
          : "Driver Return";
        const maxReasonLength = 15; // Increased length for better readability
        const truncatedReason = reason.length > maxReasonLength
          ? reason.substring(0, maxReasonLength) + "..."
          : reason;

        firstPage.drawText(truncatedReason, {
          x: margin + 360,
          y: itemY + 10,
          size: 7,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Add separator line between items
        if (index < maxItemsOnFirstPage - 1) {
          firstPage.drawLine({
            start: { x: margin + 15, y: itemY - 10 },
            end: { x: pageWidth - margin - 15, y: itemY - 10 },
            thickness: 0.5,
            color: rgb(0.9, 0.9, 0.9),
          });
        }
      });

      // Add truncation notice if items were cut off
      if (willOverflow) {
        const truncationY = returnsSectionY - actualHeight + 15;
        firstPage.drawText(`... and ${returns.length - maxItemsOnFirstPage} more items (see complete list in system)`, {
          x: margin + 15,
          y: truncationY,
          size: 8,
          font: helvetica,
          color: rgb(0.6, 0.6, 0.6),
        });
      }

      // Update Y position for the image (use the calculated actual height)
      returnsSectionY = returnsSectionY - actualHeight;
    }

    // ADD IMAGE LINKS SECTION - Simple Text-Based Approach
    console.log(`=== IMAGE LINKS SECTION ===`);
    console.log(`Adding ${imageUrls.length} image links to PDF`);

    if (imageUrls.length > 0) {
      // Calculate available space for image links section
      const footerSpace = 60;
      const availableSpace = returnsSectionY - footerSpace;

      // Draw image links section background
      const sectionHeight = Math.min(120, availableSpace);
      firstPage.drawRectangle({
        x: margin,
        y: returnsSectionY - sectionHeight,
        width: contentWidth,
        height: sectionHeight,
        color: rgb(0.95, 0.98, 0.95),
        borderColor: rgb(0.6, 0.8, 0.6),
        borderWidth: 2,
      });

      // Add section title with icon
      firstPage.drawText("DELIVERY PHOTOS", {
        x: margin + 15,
        y: returnsSectionY - 25,
        size: 12,
        font: helveticaBold,
        color: rgb(0.2, 0.6, 0.2),
      });

      // Add image count with professional styling
      const countText = `${imageUrls.length} photo${imageUrls.length !== 1 ? 's' : ''} uploaded`;
      const countWidth = helvetica.widthOfTextAtSize(countText, 9);
      firstPage.drawRectangle({
        x: pageWidth - margin - countWidth - 25,
        y: returnsSectionY - 32,
        width: countWidth + 16,
        height: 16,
        color: rgb(0.9, 0.95, 0.9),
        borderColor: rgb(0.6, 0.8, 0.6),
        borderWidth: 1,
      });

      firstPage.drawText(countText, {
        x: pageWidth - margin - countWidth - 17,
        y: returnsSectionY - 27,
        size: 9,
        font: helveticaBold,
        color: rgb(0.2, 0.6, 0.2),
      });

      // Add instruction text for customers
      firstPage.drawText("Copy the links below to view delivery photos:", {
        x: margin + 15,
        y: returnsSectionY - 45,
        size: 10,
        font: helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Add clean image links for customers
      imageUrls.forEach((img, index) => {
        const linkY = returnsSectionY - 65 - (index * 20); // Increased spacing for better readability
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const fullUrl = `${baseUrl}${img.url}`;

        // Add image label
        firstPage.drawText(`Image ${index + 1}:`, {
          x: margin + 15,
          y: linkY + 5,
          size: 10,
          font: helveticaBold,
          color: rgb(0.2, 0.2, 0.2),
        });

        // Add the URL on the next line
        firstPage.drawText(fullUrl, {
          x: margin + 15,
          y: linkY - 8,
          size: 8,
          font: helvetica,
          color: rgb(0.1, 0.3, 0.7), // Blue color for links
        });
      });

      // Add note for customers
      firstPage.drawText("Note: Copy and paste the links above into your browser to view photos", {
        x: margin + 15,
        y: returnsSectionY - sectionHeight + 15,
        size: 8,
        font: helveticaOblique,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Update returnsSectionY for footer positioning
      returnsSectionY = returnsSectionY - sectionHeight;
    }

    // Add enhanced footer to first page
    const footerY = 40;

    // Footer background
    firstPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: footerY + 15,
      color: lightGray,
    });

    // Footer border
    firstPage.drawLine({
      start: { x: 0, y: footerY + 15 },
      end: { x: pageWidth, y: footerY + 15 },
      thickness: 2,
      color: accentColor,
    });

    // Thank you message with icon
    firstPage.drawText("Thank you for choosing B&R Food Services!", {
      x: margin,
      y: footerY,
      size: 11,
      font: helveticaBold,
      color: accentColor,
    });

    // Contact information
    firstPage.drawText("Questions? Contact support for assistance", {
      x: margin,
      y: footerY - 15,
      size: 9,
      font: helvetica,
      color: secondaryColor,
    });

    // Calculate total pages based on layout strategy
    let actualTotalPages = 1; // Always have at least the first page

    if (imageUrls.length > 0) {
      // All images are now displayed as links on the first page
      // No additional pages needed for images
      actualTotalPages = 1;
    }

    const pageNumberText = `Page 1 of ${actualTotalPages}`;
    const pageNumberWidth = helvetica.widthOfTextAtSize(pageNumberText, 10);
    firstPage.drawText(pageNumberText, {
      x: pageWidth - margin - pageNumberWidth,
      y: footerY,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const pdfFilePath = path.join(pdfDir, `${fileName}.pdf`);
    await writeFileAsync(pdfFilePath, Buffer.from(pdfBytes));

    // Create the public URL for the PDF
    const pdfUrl = `/uploads/pdf/${fileName}.pdf`;

    // Update the stop with the PDF URL and image URLs
    await prisma.stop.update({
      where: {
        id: stop.id,
      },
      data: {
        signedInvoicePdfUrl: pdfUrl,
        // TODO: Add invoiceImageUrls back after Prisma client is properly updated
        // invoiceImageUrls: imageUrls?.map(img => img.url) || [], // Store image URLs for admin preview
        // Don't automatically update status here since the client will handle it
        // This allows for better control flow and error handling on the client side
      },
    });

    // Test email notification (optional - remove this in production)
    console.log(`=== EMAIL NOTIFICATION TEST ===`);
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: stop.customerId },
        select: { email: true, name: true },
      });

      if (customer && customer.email) {
        console.log(`Customer email found: ${customer.email}`);
        console.log(`Email notification will be sent when stop status is set to COMPLETED`);
      } else {
        console.log(`No customer email found for stop ${stop.id}`);
      }
    } catch (emailError) {
      console.error("Error checking customer email:", emailError);
    }

    return NextResponse.json({
      message: "PDF generated successfully with image links",
      pdfUrl,
      imageUrls: imageUrls.map(img => img.url),
      totalImages: allImages.length,
      isComplete: true
    });
  } catch (error) {
    console.error("Error uploading invoice:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
