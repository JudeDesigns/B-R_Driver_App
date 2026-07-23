import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateDeliveryPDF } from "@/utils/pdfGenerator";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { emitStopStatusUpdate } from "@/app/api/socketio/route";
import { deleteUploadFiles } from "@/lib/uploadFilePaths";

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using its properties (Next.js 15 requirement)
    const { id } = await params;
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

    // Get the driver's username for access verification
    const driver = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        username: true,
        fullName: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

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
                  OR: [
                    { driverNameFromUpload: driver.username },
                    { driverNameFromUpload: driver.fullName },
                  ],
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
        payments: {
          orderBy: {
            createdAt: 'desc',
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

    // SAFETY CHECK ENFORCEMENT: Check if driver has completed safety check for this route
    const safetyCheck = await prisma.safetyCheck.findFirst({
      where: {
        routeId: stop.routeId,
        driverId: decoded.id,
        type: "START_OF_DAY",
        isDeleted: false,
      },
    });

    if (!safetyCheck) {
      return NextResponse.json(
        {
          message: "Safety check must be completed before uploading documents",
          requiresSafetyCheck: true,
          routeId: stop.routeId,
        },
        { status: 403 }
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
    // Category tag used only for the admin "All Financial" PDF filter below.
    // Does not affect the combined image set, PDF, or customer email, which
    // continue to include every image exactly as before.
    const category = formData.get('category') as string;
    const categoryTag = category === 'delivery' ? 'dlv' : 'fin';

    // Check file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Read the file as an ArrayBuffer
    const fileBuffer = await file.arrayBuffer();

    // Create a unique filename with session ID for grouping. The category
    // tag is embedded so the admin "All Financial" report can later filter
    // by it; it has no effect on the combined image set used everywhere else.
    const timestamp = new Date().getTime();
    const fileName = `invoice_${stop.id}_${timestamp}_${sessionId}_${categoryTag}_img${imageIndex + 1}`;

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

    // Merge = images already confirmed in the database (from a previously
    // completed upload, i.e. the trusted source of truth) + the images just
    // uploaded in this session. We deliberately do NOT scan the whole
    // uploads folder for every file matching this stop's ID — that would
    // risk resurrecting stale/orphaned files left over from old, incomplete,
    // or already-superseded sessions. Anchoring to the DB guarantees we only
    // ever include images that were genuinely part of a real upload.
    const allImages: { buffer: Buffer; timestamp: number; index: number; name: string }[] = [];

    const previousImageUrlsForMerge: string[] = Array.isArray(stop.invoiceImageUrls)
      ? (stop.invoiceImageUrls as string[])
      : [];

    // 1) Re-read the previously confirmed images from disk (if still present).
    for (const url of previousImageUrlsForMerge) {
      const name = path.basename(url);
      const match = name.match(/^invoice_.+_(\d+)_[^_]+_(?:fin_|dlv_)?img(\d+)\.jpg$/);
      const filePath = path.join(uploadsDir, name);
      try {
        const buffer = await readFileAsync(filePath);
        allImages.push({
          buffer,
          timestamp: match ? parseInt(match[1], 10) : 0,
          index: match ? parseInt(match[2], 10) : 0,
          name
        });
      } catch {
        console.warn(`Previously uploaded image missing on disk, skipping: ${name}`);
      }
    }

    // 2) Add the images uploaded in THIS session (matched by sessionId).
    const sessionPattern = new RegExp(`invoice_${stop.id}_\\d+_${sessionId}_(?:fin_|dlv_)?img\\d+\\.jpg$`);
    try {
      const files = await readdirAsync(uploadsDir);
      for (const file of files) {
        if (sessionPattern.test(file)) {
          const match = file.match(/^invoice_.+_(\d+)_[^_]+_(?:fin_|dlv_)?img(\d+)\.jpg$/);
          const imagePath = path.join(uploadsDir, file);
          allImages.push({
            buffer: await readFileAsync(imagePath),
            timestamp: match ? parseInt(match[1], 10) : timestamp,
            index: match ? parseInt(match[2], 10) : imageIndex + 1,
            name: file
          });
          console.log(`Found new session image: ${file}`);
        }
      }
    } catch (error) {
      console.error("Error reading session images:", error);
      // Fallback to current image only
      allImages.push({
        buffer: Buffer.from(fileBuffer),
        timestamp,
        index: imageIndex + 1,
        name: `${fileName}.jpg`
      });
    }

    // De-duplicate by filename (defensive, shouldn't normally collide)
    const seen = new Set<string>();
    const dedupedImages = allImages.filter((img) => {
      if (seen.has(img.name)) return false;
      seen.add(img.name);
      return true;
    });
    allImages.length = 0;
    allImages.push(...dedupedImages);

    console.log(`Total merged images (previous + new session): ${allImages.length}`);

    // Sort chronologically (by upload timestamp, then index) so images from
    // earlier sessions always appear before newly added ones in the PDF.
    allImages.sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
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
      adminNotes: null, // Admin notes not included in this query
      orderNumberWeb: stop.orderNumberWeb,
      quickbooksInvoiceNum: stop.quickbooksInvoiceNum,
      amount: stop.amount,
      driverPaymentAmount: stop.driverPaymentAmount,
      driverPaymentMethods: stop.driverPaymentMethods,
      paymentFlagNotPaid: stop.paymentFlagNotPaid,
      payments: stop.payments
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

    // Generate PDF using Puppeteer with extended timeout for large images (increased for 30+ images)
    const pdfBuffer = await Promise.race([
      generateDeliveryPDF(stopData, imageUrls, returnsData, baseUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timeout after 15 minutes')), 900000)
      )
    ]);

    console.log(`PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

    // Save the PDF to file system
    const pdfFilePath = path.join(pdfDir, `${fileName}.pdf`);
    await writeFileAsync(pdfFilePath, pdfBuffer);

    // Create the public URL for the PDF
    const pdfUrl = `/uploads/pdf/${fileName}.pdf`;

    // Capture the previous image set and PDF before overwriting so we can
    // atomically clean up the orphans only AFTER the DB write succeeds.
    // This replaces the old destructive "clear-images before upload" pattern
    // that wiped files on disk before the new ones were committed.
    const previousImageUrls: string[] = Array.isArray(stop.invoiceImageUrls)
      ? (stop.invoiceImageUrls as string[])
      : [];
    const previousPdfUrl: string | null = stop.signedInvoicePdfUrl ?? null;

    const newImageUrls = imageUrls?.map(img => img.url) || [];

    // Update the stop with the PDF URL and image URLs
    await prisma.stop.update({
      where: {
        id: stop.id,
      },
      data: {
        signedInvoicePdfUrl: pdfUrl,
        invoiceImageUrls: newImageUrls, // Store image URLs for admin preview
        // Don't automatically update status here since the client will handle it
        // This allows for better control flow and error handling on the client side
      },
    });

    // Swap-and-clean: now that the DB points at the new files, remove any
    // previous-session image files that are no longer referenced. Same for
    // the previous PDF if it changed. Failures are logged but never fatal —
    // the new upload is already committed.
    try {
      const newImageSet = new Set(newImageUrls);
      const orphanImages = previousImageUrls.filter((u) => u && !newImageSet.has(u));
      const orphanPdf =
        previousPdfUrl && previousPdfUrl !== pdfUrl ? [previousPdfUrl] : [];
      const toDelete = [...orphanImages, ...orphanPdf];
      if (toDelete.length > 0) {
        const deleted = await deleteUploadFiles(toDelete);
        console.log(
          `Swap-and-clean for stop ${stop.id}: removed ${deleted.length}/${toDelete.length} orphaned upload(s).`
        );
      }
    } catch (cleanupError) {
      console.warn("Post-upload orphan cleanup failed (non-fatal):", cleanupError);
    }

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
