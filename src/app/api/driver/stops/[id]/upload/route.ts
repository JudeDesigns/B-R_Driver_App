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

    // Create a PDF with multiple images support
    const pdfDoc = await PDFDocument.create();

    // Get all images for this stop (check for existing images from previous uploads)
    const imagePattern = new RegExp(`invoice_${stop.id}_.*_img\\d+\\.jpg$`);
    const existingImages = [];

    try {
      const files = await fs.readdir(uploadsDir);
      for (const fileName of files) {
        if (imagePattern.test(fileName)) {
          const imagePath = path.join(uploadsDir, fileName);
          const imageBuffer = await fs.readFile(imagePath);
          existingImages.push({
            buffer: imageBuffer,
            name: fileName
          });
        }
      }
    } catch (error) {
      console.log("No existing images found or error reading directory");
    }

    // Add current image to the list
    existingImages.push({
      buffer: Buffer.from(fileBuffer),
      name: `${fileName}.jpg`
    });

    // Sort images by their index to maintain order
    existingImages.sort((a, b) => {
      const aIndex = parseInt(a.name.match(/_img(\d+)\.jpg$/)?.[1] || '0');
      const bIndex = parseInt(b.name.match(/_img(\d+)\.jpg$/)?.[1] || '0');
      return aIndex - bIndex;
    });

    // Embed all images
    const embeddedImages = [];
    for (const imageData of existingImages) {
      try {
        const image = await pdfDoc.embedJpg(imageData.buffer);
        embeddedImages.push(image);
      } catch (error) {
        console.error("Error embedding image:", error);
        // Try as PNG if JPG fails
        try {
          const image = await pdfDoc.embedPng(imageData.buffer);
          embeddedImages.push(image);
        } catch (pngError) {
          console.error("Error embedding image as PNG:", pngError);
        }
      }
    }

    if (embeddedImages.length === 0) {
      return NextResponse.json(
        { message: "Failed to process any images" },
        { status: 500 }
      );
    }

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
        y: returnsSectionY - 50,
        width: contentWidth - 20,
        height: 20,
        color: rgb(0.9, 0.85, 0.85),
        borderColor: rgb(0.8, 0.7, 0.7),
        borderWidth: 1,
      });

      // Enhanced table headers with better spacing (fixed column widths)
      firstPage.drawText("SKU", {
        x: margin + 15,
        y: returnsSectionY - 45,
        size: 8,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });

      firstPage.drawText("Product Name", {
        x: margin + 85,
        y: returnsSectionY - 45,
        size: 8,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });

      firstPage.drawText("Description", {
        x: margin + 200,
        y: returnsSectionY - 45,
        size: 8,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });

      firstPage.drawText("Qty", {
        x: margin + 320,
        y: returnsSectionY - 45,
        size: 8,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });

      firstPage.drawText("Reason", {
        x: margin + 360,
        y: returnsSectionY - 45,
        size: 8,
        font: helveticaBold,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Add return items with enhanced formatting (limited to what fits on first page)
      returns.slice(0, maxItemsOnFirstPage).forEach((returnItem, index) => {
        const itemY = returnsSectionY - 65 - (index * itemHeight);

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

    // Add images section - improved multi-page logic
    if (embeddedImages.length > 0) {
      // Calculate remaining space on first page more accurately
      const footerSpace = 80; // Space needed for footer
      const remainingSpace = Math.max(0, returnsSectionY - footerSpace);
      const imageSpacePerImage = 200; // Minimum space needed per image including title and margins
      const headerSpaceForImagePages = 100; // Space needed for headers on additional pages
      const imagesPerAdditionalPage = Math.floor((pageHeight - headerSpaceForImagePages - footerSpace) / imageSpacePerImage);

      // Ensure we have at least 1 image per additional page
      const safeImagesPerAdditionalPage = Math.max(1, imagesPerAdditionalPage);

      let currentImageIndex = 0;

      // Add images to pages
      while (currentImageIndex < embeddedImages.length) {
        const isFirstPage = currentImageIndex === 0;
        const currentPage = isFirstPage ? firstPage : pdfDoc.addPage([612, 792]);

        // Add header for image pages (except first page which already has header)
        if (!isFirstPage) {
          // Simple header for image pages
          currentPage.drawRectangle({
            x: 0,
            y: pageHeight - 60,
            width: pageWidth,
            height: 60,
            color: rgb(0.95, 0.95, 0.95),
          });

          currentPage.drawText("B&R FOOD SERVICES - INVOICE IMAGES", {
            x: margin,
            y: pageHeight - 35,
            size: 16,
            font: helveticaBold,
            color: accentColor,
          });
        }

        // Calculate how many images to put on this page with improved logic
        const startY = isFirstPage ? returnsSectionY - 50 : pageHeight - headerSpaceForImagePages;
        const availableHeight = isFirstPage ? remainingSpace : pageHeight - headerSpaceForImagePages - footerSpace;

        // Calculate images that can fit on this page
        let imagesOnThisPage;
        if (isFirstPage) {
          // For first page, check if we have enough space for at least one image
          imagesOnThisPage = availableHeight >= imageSpacePerImage ?
            Math.min(embeddedImages.length - currentImageIndex, Math.floor(availableHeight / imageSpacePerImage)) : 0;
        } else {
          // For additional pages, ensure we place at least 1 image but not more than what fits
          imagesOnThisPage = Math.min(
            embeddedImages.length - currentImageIndex,
            Math.max(1, Math.floor(availableHeight / imageSpacePerImage))
          );
        }

        // If no images can fit on first page, skip to next page
        if (isFirstPage && imagesOnThisPage === 0) {
          continue; // This will create a new page on next iteration
        }

        // Add images to current page
        for (let i = 0; i < imagesOnThisPage && currentImageIndex < embeddedImages.length; i++) {
          const image = embeddedImages[currentImageIndex];
          const imageY = startY - (i * imageSpacePerImage);

          // Add image title
          currentPage.drawText(`Invoice Image ${currentImageIndex + 1}:`, {
            x: margin,
            y: imageY,
            size: 12,
            font: helveticaBold,
            color: primaryColor,
          });

          // Calculate image dimensions
          const maxImageWidth = contentWidth;
          const maxImageHeight = imageSpacePerImage - 40; // Leave space for title

          const imgWidth = image.width;
          const imgHeight = image.height;

          let scaledWidth = imgWidth;
          let scaledHeight = imgHeight;

          // Scale to fit within bounds
          if (imgWidth > maxImageWidth) {
            const scale = maxImageWidth / imgWidth;
            scaledWidth = imgWidth * scale;
            scaledHeight = imgHeight * scale;
          }

          if (scaledHeight > maxImageHeight) {
            const scale = maxImageHeight / scaledHeight;
            scaledWidth = scaledWidth * scale;
            scaledHeight = scaledHeight * scale;
          }

          // Center image horizontally
          const imageX = margin + (contentWidth - scaledWidth) / 2;
          const finalImageY = imageY - 25 - scaledHeight;

          // Draw image border
          currentPage.drawRectangle({
            x: imageX - 2,
            y: finalImageY - 2,
            width: scaledWidth + 4,
            height: scaledHeight + 4,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });

          // Draw the image
          currentPage.drawImage(image, {
            x: imageX,
            y: finalImageY,
            width: scaledWidth,
            height: scaledHeight,
          });

          currentImageIndex++;
        }

        // Add page number (only for additional pages, first page has its own footer)
        if (!isFirstPage) {
          // Calculate total pages more accurately
          const imagesOnFirstPage = Math.floor(remainingSpace / imageSpacePerImage);
          const remainingImages = Math.max(0, embeddedImages.length - imagesOnFirstPage);
          const additionalPages = remainingImages > 0 ? Math.ceil(remainingImages / safeImagesPerAdditionalPage) : 0;
          const totalPages = 1 + additionalPages;

          // Calculate current page number
          const imagesProcessedBeforeThisPage = currentImageIndex - imagesOnThisPage;
          const imagesAfterFirstPage = Math.max(0, imagesProcessedBeforeThisPage - imagesOnFirstPage);
          const currentPageNum = 2 + Math.floor(imagesAfterFirstPage / safeImagesPerAdditionalPage);

          const pageNumberText = `Page ${currentPageNum} of ${totalPages}`;
          const pageNumberWidth = helvetica.widthOfTextAtSize(pageNumberText, 10);
          currentPage.drawText(pageNumberText, {
            x: pageWidth - margin - pageNumberWidth,
            y: 30,
            size: 10,
            font: helvetica,
            color: secondaryColor,
          });
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

    // Calculate total pages based on improved logic
    let actualTotalPages = 1; // Always have at least the first page

    if (embeddedImages.length > 0) {
      // Use the same calculation logic as above for consistency
      const imagesOnFirstPage = Math.floor(remainingSpace / imageSpacePerImage);
      const remainingImages = Math.max(0, embeddedImages.length - imagesOnFirstPage);
      const additionalPages = remainingImages > 0 ? Math.ceil(remainingImages / safeImagesPerAdditionalPage) : 0;
      actualTotalPages = 1 + additionalPages;
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

    // Get the current time
    const now = new Date();

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
