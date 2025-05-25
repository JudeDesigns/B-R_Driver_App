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

    // Check file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Read the file as an ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Create a unique filename
    const timestamp = new Date().getTime();
    const uniqueId = Math.random().toString(36).substring(2, 15);
    const fileName = `invoice_${stop.id}_${timestamp}_${uniqueId}`;

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

    // Create a PDF with the image
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size

    // Convert image to format PDF-lib can use
    let image;
    try {
      if (file.type === "image/jpeg" || file.type === "image/jpg") {
        image = await pdfDoc.embedJpg(Buffer.from(fileBuffer));
      } else if (file.type === "image/png") {
        image = await pdfDoc.embedPng(Buffer.from(fileBuffer));
      } else {
        // For other image types, we'll save as JPEG and then embed
        image = await pdfDoc.embedJpg(Buffer.from(fileBuffer));
      }
    } catch (error) {
      console.error("Error embedding image:", error);
      return NextResponse.json(
        { message: "Failed to process image" },
        { status: 500 }
      );
    }

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
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    // Draw header background
    page.drawRectangle({
      x: 0,
      y: pageHeight - 100,
      width: pageWidth,
      height: 100,
      color: rgb(0.95, 0.95, 0.95),
    });

    // Draw header border
    page.drawLine({
      start: { x: 0, y: pageHeight - 100 },
      end: { x: pageWidth, y: pageHeight - 100 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    // Add company name
    page.drawText("B&R FOOD SERVICES", {
      x: margin,
      y: pageHeight - 40,
      size: 20,
      font: helveticaBold,
      color: accentColor,
    });

    // Add document title
    page.drawText("DELIVERY INVOICE", {
      x: margin,
      y: pageHeight - 65,
      size: 14,
      font: helvetica,
      color: secondaryColor,
    });

    // Add date on the right
    const dateText = `Date: ${new Date().toLocaleDateString()}`;
    const dateTextWidth = helvetica.widthOfTextAtSize(dateText, 10);
    page.drawText(dateText, {
      x: pageWidth - margin - dateTextWidth,
      y: pageHeight - 40,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Add invoice number on the right
    const invoiceText = `Invoice #: ${stop.quickbooksInvoiceNum || "N/A"}`;
    const invoiceTextWidth = helvetica.widthOfTextAtSize(invoiceText, 10);
    page.drawText(invoiceText, {
      x: pageWidth - margin - invoiceTextWidth,
      y: pageHeight - 55,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Add route number on the right
    const routeText = `Route #: ${stop.route.routeNumber || "N/A"}`;
    const routeTextWidth = helvetica.widthOfTextAtSize(routeText, 10);
    page.drawText(routeText, {
      x: pageWidth - margin - routeTextWidth,
      y: pageHeight - 70,
      size: 10,
      font: helvetica,
      color: secondaryColor,
    });

    // Customer information section
    const customerSectionY = pageHeight - 130;

    // Draw customer section background
    page.drawRectangle({
      x: margin,
      y: customerSectionY - 60,
      width: contentWidth,
      height: 60,
      color: rgb(0.97, 0.97, 1),
      borderColor: rgb(0.8, 0.8, 0.9),
      borderWidth: 1,
    });

    // Add customer section title
    page.drawText("CUSTOMER INFORMATION", {
      x: margin + 10,
      y: customerSectionY - 20,
      size: 10,
      font: helveticaBold,
      color: accentColor,
    });

    // Add customer name
    page.drawText(`Customer: ${stop.customer.name}`, {
      x: margin + 10,
      y: customerSectionY - 35,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Add customer address
    page.drawText(`Address: ${stop.customer.address}`, {
      x: margin + 10,
      y: customerSectionY - 50,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Delivery information section
    const deliverySectionY = customerSectionY - 80;

    // Draw delivery section background
    page.drawRectangle({
      x: margin,
      y: deliverySectionY - 60,
      width: contentWidth,
      height: 60,
      color: rgb(0.97, 0.97, 1),
      borderColor: rgb(0.8, 0.8, 0.9),
      borderWidth: 1,
    });

    // Add delivery section title
    page.drawText("DELIVERY INFORMATION", {
      x: margin + 10,
      y: deliverySectionY - 20,
      size: 10,
      font: helveticaBold,
      color: accentColor,
    });

    // Add delivery date
    page.drawText(
      `Delivery Date: ${new Date(stop.route.date).toLocaleDateString()}`,
      {
        x: margin + 10,
        y: deliverySectionY - 35,
        size: 10,
        font: helvetica,
        color: primaryColor,
      }
    );

    // Add delivery status
    page.drawText(`Status: ${stop.status}`, {
      x: margin + 10,
      y: deliverySectionY - 50,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Add delivery time on the right side
    const timeText = `Time: ${new Date().toLocaleTimeString()}`;
    const timeTextWidth = helvetica.widthOfTextAtSize(timeText, 10);
    page.drawText(timeText, {
      x: pageWidth - margin - timeTextWidth - 10,
      y: deliverySectionY - 35,
      size: 10,
      font: helvetica,
      color: primaryColor,
    });

    // Returns section (if any returns exist)
    let returnsSectionY = deliverySectionY - 80;

    if (returns.length > 0) {
      // Draw returns section background
      page.drawRectangle({
        x: margin,
        y: returnsSectionY - 30 - returns.length * 20,
        width: contentWidth,
        height: 30 + returns.length * 20,
        color: rgb(1, 0.97, 0.97),
        borderColor: rgb(0.9, 0.8, 0.8),
        borderWidth: 1,
      });

      // Add returns section title
      page.drawText("RETURNED ITEMS", {
        x: margin + 10,
        y: returnsSectionY - 20,
        size: 10,
        font: helveticaBold,
        color: rgb(0.8, 0.2, 0.2), // Red for returns
      });

      // Add table headers
      page.drawText("Product", {
        x: margin + 20,
        y: returnsSectionY - 35,
        size: 9,
        font: helveticaBold,
        color: primaryColor,
      });

      page.drawText("Quantity", {
        x: margin + 200,
        y: returnsSectionY - 35,
        size: 9,
        font: helveticaBold,
        color: primaryColor,
      });

      page.drawText("Reason", {
        x: margin + 280,
        y: returnsSectionY - 35,
        size: 9,
        font: helveticaBold,
        color: primaryColor,
      });

      // Add return items
      returns.forEach((returnItem, index) => {
        const itemY = returnsSectionY - 50 - index * 20;

        // Product name/code
        page.drawText(
          returnItem.product?.name ||
            returnItem.orderItemIdentifier ||
            "Unknown Product",
          {
            x: margin + 20,
            y: itemY,
            size: 9,
            font: helvetica,
            color: primaryColor,
          }
        );

        // Quantity
        page.drawText(returnItem.quantity.toString(), {
          x: margin + 200,
          y: itemY,
          size: 9,
          font: helvetica,
          color: primaryColor,
        });

        // Reason
        page.drawText(returnItem.reasonCode || "N/A", {
          x: margin + 280,
          y: itemY,
          size: 9,
          font: helvetica,
          color: primaryColor,
        });
      });

      // Update Y position for the image
      returnsSectionY = returnsSectionY - 50 - returns.length * 20;
    }

    // Signature section
    const signatureSectionY = returnsSectionY - 30;

    // Add signature section title
    page.drawText("SIGNATURE", {
      x: margin,
      y: signatureSectionY,
      size: 12,
      font: helveticaBold,
      color: accentColor,
    });

    // Calculate dimensions to fit the image on the page
    const imgWidth = image.width;
    const imgHeight = image.height;
    const maxImageWidth = contentWidth;
    const maxImageHeight = signatureSectionY - margin - 50; // Leave some space at the bottom

    let scaledWidth = imgWidth;
    let scaledHeight = imgHeight;

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

    // Center the image horizontally
    const x = (pageWidth - scaledWidth) / 2;
    // Position the image below the signature title
    const y = signatureSectionY - 20 - scaledHeight;

    // Draw the image
    page.drawImage(image, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });

    // Add footer
    const footerY = 30;
    page.drawLine({
      start: { x: margin, y: footerY + 10 },
      end: { x: pageWidth - margin, y: footerY + 10 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText("Thank you for your business!", {
      x: margin,
      y: footerY,
      size: 10,
      font: helveticaOblique,
      color: secondaryColor,
    });

    const pageNumberText = `Page 1 of 1`;
    const pageNumberWidth = helvetica.widthOfTextAtSize(pageNumberText, 10);
    page.drawText(pageNumberText, {
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
