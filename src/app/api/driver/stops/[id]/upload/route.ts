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
    const { id } = context.params;
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

    // Add header with delivery information
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const headerY = page.getHeight() - 50;

    page.drawText("B&R FOOD SERVICES - DELIVERY INVOICE", {
      x: 50,
      y: headerY,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Customer: ${stop.customer.name}`, {
      x: 50,
      y: headerY - 20,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Route: ${stop.route.routeNumber || "N/A"}`, {
      x: 50,
      y: headerY - 35,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Date: ${new Date(stop.route.date).toLocaleDateString()}`, {
      x: 50,
      y: headerY - 50,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Invoice #: ${stop.quickbooksInvoiceNum || "N/A"}`, {
      x: 50,
      y: headerY - 65,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`Completed: ${new Date().toLocaleString()}`, {
      x: 50,
      y: headerY - 80,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });

    // Calculate dimensions to fit the image on the page
    const imgWidth = image.width;
    const imgHeight = image.height;
    const pageWidth = page.getWidth() - 100; // Margins
    const pageHeight = page.getHeight() - 200; // Margins and header

    let scaledWidth = imgWidth;
    let scaledHeight = imgHeight;

    if (imgWidth > pageWidth) {
      const scale = pageWidth / imgWidth;
      scaledWidth = imgWidth * scale;
      scaledHeight = imgHeight * scale;
    }

    if (scaledHeight > pageHeight) {
      const scale = pageHeight / scaledHeight;
      scaledWidth = scaledWidth * scale;
      scaledHeight = scaledHeight * scale;
    }

    // Draw the image
    page.drawImage(image, {
      x: 50,
      y: headerY - 100 - scaledHeight,
      width: scaledWidth,
      height: scaledHeight,
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
