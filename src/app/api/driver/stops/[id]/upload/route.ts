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

    // Check file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Read the file as an ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Create a unique filename with image index
    const timestamp = new Date().getTime();
    const uniqueId = Math.random().toString(36).substring(2, 15);
    const fileName = `invoice_${stop.id}_${timestamp}_${uniqueId}_img${imageIndex + 1}`;

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

    // Collect all images for this stop
    const allImages = [];

    // Get all uploaded images for this stop
    const imagePattern = new RegExp(`invoice_${stop.id}_.*_img\\d+\\.jpg$`);

    try {
      const files = await readdirAsync(uploadsDir);
      console.log(`Scanning ${files.length} files for images...`);

      for (const file of files) {
        if (imagePattern.test(file)) {
          const imagePath = path.join(uploadsDir, file);
          const imageBuffer = await readFileAsync(imagePath);
          const imageIndex = parseInt(file.match(/_img(\d+)\.jpg$/)?.[1] || '0');

          allImages.push({
            buffer: imageBuffer,
            index: imageIndex,
            name: file
          });
          console.log(`Found image: ${file} (index: ${imageIndex})`);
        }
      }
    } catch (error) {
      console.error("Error reading images:", error);
    }

    // Add current image
    allImages.push({
      buffer: Buffer.from(fileBuffer),
      index: imageIndex + 1,
      name: `${fileName}.jpg`
    });

    // Sort by index
    allImages.sort((a, b) => a.index - b.index);
    console.log(`Total images to process: ${allImages.length}`);

    // Embed all images
    const embeddedImages = [];
    for (const img of allImages) {
      try {
        const embeddedImage = await pdfDoc.embedJpg(img.buffer);
        embeddedImages.push(embeddedImage);
        console.log(`Embedded image: ${img.name}`);
      } catch (error) {
        console.error(`Failed to embed ${img.name}:`, error);
      }
    }

    console.log(`Successfully embedded ${embeddedImages.length} images`);

    // Create first page with invoice details
    const firstPage = pdfDoc.addPage([612, 792]); // Letter size

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(
      StandardFonts.HelveticaOblique
    );

    // Define colors
    const primaryColor = rgb(0, 0, 0);
    const secondaryColor = rgb(0.2, 0.2, 0.2);
    const accentColor = rgb(0.1, 0.4, 0.7);

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

    // Add document title
    firstPage.drawText("DELIVERY INVOICE", {
      x: margin,
      y: pageHeight - 65,
      size: 14,
      font: helvetica,
      color: secondaryColor,
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

    // Customer information section
    const customerSectionY = pageHeight - 130;

    // Draw customer section background
    firstPage.drawRectangle({
      x: margin,
      y: customerSectionY - 60,
      width: contentWidth,
      height: 60,
      color: rgb(0.97, 0.97, 1),
      borderColor: rgb(0.8, 0.8, 0.9),
      borderWidth: 1,
    });

    // Add customer section title
    firstPage.drawText("CUSTOMER INFORMATION", {
      x: margin + 10,
      y: customerSectionY - 20,
      size: 10,
      font: helveticaBold,
      color: accentColor,
    });

    // Add customer name
    firstPage.drawText(`Customer: ${stop.customer.name}`, {
      x: margin + 10,
      y: customerSectionY - 35,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Add customer address
    firstPage.drawText(`Address: ${stop.customer.address}`, {
      x: margin + 10,
      y: customerSectionY - 50,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Delivery information section
    const deliverySectionY = customerSectionY - 80;

    // Draw delivery section background
    firstPage.drawRectangle({
      x: margin,
      y: deliverySectionY - 60,
      width: contentWidth,
      height: 60,
      color: rgb(0.97, 0.97, 1),
      borderColor: rgb(0.8, 0.8, 0.9),
      borderWidth: 1,
    });

    // Add delivery section title
    firstPage.drawText("DELIVERY INFORMATION", {
      x: margin + 10,
      y: deliverySectionY - 20,
      size: 10,
      font: helveticaBold,
      color: accentColor,
    });

    // Add delivery date
    firstPage.drawText(
      `Delivery Date: ${new Date(stop.route.date).toLocaleDateString()}`,
      {
        x: margin + 10,
        y: deliverySectionY - 35,
        size: 10,
        font: helvetica,
        color: primaryColor,
      }
    );

    // Add delivery status (show as COMPLETED for PDF)
    firstPage.drawText(`Status: COMPLETED`, {
      x: margin + 10,
      y: deliverySectionY - 50,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Add delivery time on the right side
    const timeText = `Time: ${new Date().toLocaleTimeString()}`;
    const timeTextWidth = helvetica.widthOfTextAtSize(timeText, 10);
    firstPage.drawText(timeText, {
      x: pageWidth - margin - timeTextWidth - 10,
      y: deliverySectionY - 35,
      size: 10,
      font: helvetica,
      color: primaryColor,
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

      // Add returns section title
      firstPage.drawText("RETURNED ITEMS", {
        x: margin + 15,
        y: returnsSectionY - 25,
        size: 12,
        font: helveticaBold,
        color: rgb(0.7, 0.2, 0.2),
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

        // Reason (fixed width: remaining space)
        const reason = returnItem.reasonCode || "N/A";
        const maxReasonLength = 12;
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

    // REFACTORED IMAGE LAYOUT - Simple and Accommodating
    console.log(`=== IMAGE LAYOUT START ===`);
    console.log(`Laying out ${embeddedImages.length} images`);

    if (embeddedImages.length > 0) {
      // Calculate available space on first page
      const footerSpace = 60;
      const availableSpaceFirstPage = returnsSectionY - footerSpace;

      console.log(`Available space on first page: ${availableSpaceFirstPage}px`);

      // Determine layout strategy based on number of images and available space
      let layoutStrategy;

      if (embeddedImages.length === 1) {
        layoutStrategy = "single-large";
      } else if (embeddedImages.length === 2 && availableSpaceFirstPage >= 300) {
        layoutStrategy = "side-by-side";
      } else if (embeddedImages.length <= 3 && availableSpaceFirstPage >= 400) {
        layoutStrategy = "compact-grid";
      } else {
        layoutStrategy = "multi-page";
      }

      console.log(`Using layout strategy: ${layoutStrategy}`);

      if (layoutStrategy === "single-large") {
        // Single large image
        const image = embeddedImages[0];
        const maxWidth = contentWidth;
        const maxHeight = availableSpaceFirstPage - 60;

        const { width, height } = calculateImageSize(image, maxWidth, maxHeight);
        const x = margin + (contentWidth - width) / 2;
        const y = returnsSectionY - 40 - height;

        firstPage.drawText("Invoice Image:", {
          x: margin,
          y: returnsSectionY - 20,
          size: 14,
          font: helveticaBold,
          color: primaryColor,
        });

        firstPage.drawImage(image, { x, y, width, height });

      } else if (layoutStrategy === "side-by-side") {
        // Two images side by side
        const imageWidth = (contentWidth - 20) / 2; // 20px gap between images
        const maxHeight = availableSpaceFirstPage - 60;

        firstPage.drawText("Invoice Images:", {
          x: margin,
          y: returnsSectionY - 20,
          size: 14,
          font: helveticaBold,
          color: primaryColor,
        });

        embeddedImages.slice(0, 2).forEach((image, index) => {
          const { width, height } = calculateImageSize(image, imageWidth, maxHeight);
          const x = margin + (index * (imageWidth + 20)) + (imageWidth - width) / 2;
          const y = returnsSectionY - 40 - height;

          firstPage.drawImage(image, { x, y, width, height });
        });

      } else if (layoutStrategy === "compact-grid") {
        // Compact grid for 3+ images
        const cols = embeddedImages.length === 3 ? 3 : 2;
        const rows = Math.ceil(embeddedImages.length / cols);
        const imageWidth = (contentWidth - (cols - 1) * 15) / cols;
        const imageHeight = (availableSpaceFirstPage - 80) / rows;

        firstPage.drawText("Invoice Images:", {
          x: margin,
          y: returnsSectionY - 20,
          size: 14,
          font: helveticaBold,
          color: primaryColor,
        });

        embeddedImages.forEach((image, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const { width, height } = calculateImageSize(image, imageWidth, imageHeight);

          const x = margin + col * (imageWidth + 15) + (imageWidth - width) / 2;
          const y = returnsSectionY - 40 - row * (imageHeight + 15) - height;

          firstPage.drawImage(image, { x, y, width, height });
        });

      } else {
        // Multi-page layout - simple approach
        let currentImageIndex = 0;

        while (currentImageIndex < embeddedImages.length) {
          const isFirstPage = currentImageIndex === 0;
          const currentPage = isFirstPage ? firstPage : pdfDoc.addPage([612, 792]);

          if (!isFirstPage) {
            currentPage.drawText("B&R FOOD SERVICES - INVOICE IMAGES", {
              x: margin,
              y: pageHeight - 40,
              size: 16,
              font: helveticaBold,
              color: accentColor,
            });
          }

          const startY = isFirstPage ? returnsSectionY - 40 : pageHeight - 80;
          const availableHeight = isFirstPage ? availableSpaceFirstPage : pageHeight - 120;
          const imagesPerPage = isFirstPage ? 1 : 2; // Conservative approach

          for (let i = 0; i < imagesPerPage && currentImageIndex < embeddedImages.length; i++) {
            const image = embeddedImages[currentImageIndex];
            const imageY = startY - (i * (availableHeight / imagesPerPage));

            const { width, height } = calculateImageSize(image, contentWidth, availableHeight / imagesPerPage - 40);
            const x = margin + (contentWidth - width) / 2;
            const y = imageY - height;

            currentPage.drawText(`Invoice Image ${currentImageIndex + 1}:`, {
              x: margin,
              y: imageY,
              size: 12,
              font: helveticaBold,
              color: primaryColor,
            });

            currentPage.drawImage(image, { x, y, width, height });
            currentImageIndex++;
          }
        }
      }
    }

    // Add footer to first page
    const footerY = 30;
    firstPage.drawLine({
      start: { x: margin, y: footerY + 10 },
      end: { x: pageWidth - margin, y: footerY + 10 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    firstPage.drawText("Thank you for your business!", {
      x: margin,
      y: footerY,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Calculate total pages based on layout strategy
    let actualTotalPages = 1; // Always have at least the first page

    if (embeddedImages.length > 0) {
      // Simple page calculation - if more than 3 images, likely multi-page
      if (embeddedImages.length > 3) {
        // Conservative estimate: 1-2 images per additional page
        const imagesAfterFirst = Math.max(0, embeddedImages.length - 1);
        const additionalPages = Math.ceil(imagesAfterFirst / 2);
        actualTotalPages = 1 + additionalPages;
      }
      // For 3 or fewer images, all fit on first page
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

    // Update the stop with the PDF URL and mark as completed
    await prisma.stop.update({
      where: {
        id: stop.id,
      },
      data: {
        signedInvoicePdfUrl: pdfUrl,
        // Don't automatically update status here since the client will handle it
        // This allows for better control flow and error handling on the client side
      },
    });

    return NextResponse.json({
      message: "Invoice uploaded and converted to PDF successfully",
      pdfUrl,
    });
  } catch (error) {
    console.error("Error uploading invoice:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
