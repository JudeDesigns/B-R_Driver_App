import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateDeliveryPDF } from "@/utils/pdfGenerator";
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
          const imageIndexMatch = file.match(/_img(\d+)\.jpg$/);
          const fileImageIndex = parseInt(imageIndexMatch?.[1] || '0');

          allImages.push({
            buffer: await readFileAsync(imagePath),
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

    // Generate image URLs for PDF
    const imageUrls = allImages.map(img => ({
      url: `/uploads/${img.name}`,
      name: img.name,
      index: img.index
    }));

    console.log(`Generated ${imageUrls.length} image URLs:`, imageUrls.map(img => img.url));

    // Prepare stop data for PDF generation
    const stopData = {
      id: stop.id,
      customerName: stop.customer.name,
      customerAddress: stop.customer.address,
      routeNumber: stop.route.routeNumber || "",
      arrivalTime: stop.arrivalTime?.toISOString() || null,
      completionTime: stop.completionTime?.toISOString() || null,
      driverNotes: stop.driverNotes,
      adminNotes: null // Admin notes not included in this query
    };

    // Prepare returns data for PDF
    const returnsData = returns.map(returnItem => ({
      id: returnItem.id,
      productSku: returnItem.product?.sku || 'N/A',
      productDescription: returnItem.product?.description || 'N/A',
      quantity: returnItem.quantity,
      reasonCode: returnItem.reasonCode || 'Driver Return'
    }));

    console.log(`Generating PDF with Puppeteer...`);

    // Get the base URL from the request headers
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    console.log(`Using base URL for PDF generation: ${baseUrl}`);

    // Generate PDF using Puppeteer
    const pdfBuffer = await generateDeliveryPDF(stopData, imageUrls, returnsData, baseUrl);

    console.log(`PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

    // Save the PDF to file system
    const pdfFilePath = path.join(pdfDir, `${fileName}.pdf`);
    await writeFileAsync(pdfFilePath, pdfBuffer);

    // Create the public URL for the PDF
    const pdfUrl = `/uploads/pdf/${fileName}.pdf`;

    // Update the stop with the PDF URL and image URLs
    await prisma.stop.update({
      where: {
        id: stop.id,
      },
      data: {
        signedInvoicePdfUrl: pdfUrl,
        invoiceImageUrls: imageUrls?.map(img => img.url) || [], // Store image URLs for admin preview
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
