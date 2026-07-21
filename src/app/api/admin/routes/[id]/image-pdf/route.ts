import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateRouteImagePDF } from "@/utils/routeImagePdfGenerator";
import { promises as fs } from "fs";
import path from "path";

// PDF assembly with many embedded images can run well past the default 10s
// serverless budget. 5 minutes is more than enough for the largest routes
// we've seen and matches the client-side AbortController timeout.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    console.log("📄 Starting PDF generation for route images...");

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json(
        { message: "Admin access required" },
        { status: 403 }
      );
    }

    // Unwrap params
    const unwrappedParams = await Promise.resolve(params);
    const routeId = unwrappedParams.id;

    // Optional flag: when true, only images uploaded to the "Financial
    // Documents" upload box are included. Images are tagged with `_fin_`
    // or `_dlv_` in their filename at upload time; images uploaded before
    // this tagging existed have neither tag and are treated as financial
    // (legacy default) so nothing that already exists disappears from
    // reports.
    let financialOnly = false;
    try {
      const body = await request.json();
      financialOnly = body?.financialOnly === true;
    } catch {
      // No JSON body sent — default to the full (unchanged) report.
    }

    console.log(`📄 Generating PDF for route: ${routeId}${financialOnly ? " (financial documents only)" : ""}`);

    // Fetch route with all necessary data
    const route = await prisma.route.findUnique({
      where: { id: routeId },
      include: {
        stops: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          where: {
            invoiceImageUrls: {
              isEmpty: false,
            },
          },
          orderBy: {
            sequence: "asc",
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json(
        { message: "Route not found" },
        { status: 404 }
      );
    }

    console.log(`📄 Found route ${route.routeNumber} with ${route.stops.length} stops that have images`);

    // When financialOnly is requested, keep only images tagged `_fin_` in
    // their filename. Legacy images (uploaded before category tagging
    // existed) have no tag and are kept too, since they predate the split
    // and were financial-report images by default. Stops left with zero
    // images after filtering are dropped from the report.
    const stopsForReport = financialOnly
      ? route.stops
          .map((stop) => ({
            ...stop,
            invoiceImageUrls: (stop.invoiceImageUrls || []).filter(
              (url) => !url.includes("_dlv_")
            ),
          }))
          .filter((stop) => stop.invoiceImageUrls.length > 0)
      : route.stops;

    // Check if route has any images
    const totalImages = stopsForReport.reduce(
      (total, stop) => total + (stop.invoiceImageUrls?.length || 0),
      0
    );

    if (totalImages === 0) {
      return NextResponse.json(
        {
          message: financialOnly
            ? "No financial documents found for this route"
            : "No images found for this route",
        },
        { status: 400 }
      );
    }

    // Group stops by driver name
    const stopsGroupedByDriver: Record<string, typeof route.stops> = {};

    for (const stop of stopsForReport) {
      const driverName = stop.driverNameFromUpload || "Unknown Driver";
      
      if (!stopsGroupedByDriver[driverName]) {
        stopsGroupedByDriver[driverName] = [];
      }
      
      stopsGroupedByDriver[driverName].push(stop);
    }

    // Sort drivers alphabetically and sort stops within each driver by sequence
    const sortedDrivers = Object.keys(stopsGroupedByDriver).sort();
    const sortedStopsGroupedByDriver: Record<string, typeof route.stops> = {};
    
    for (const driverName of sortedDrivers) {
      sortedStopsGroupedByDriver[driverName] = stopsGroupedByDriver[driverName].sort(
        (a, b) => a.sequence - b.sequence
      );
    }

    // Prepare data for PDF generation
    const pdfData = {
      route: {
        id: route.id,
        routeNumber: route.routeNumber,
        date: route.date instanceof Date ? route.date.toISOString() : route.date,
      },
      stopsGroupedByDriver: sortedStopsGroupedByDriver,
      totalDrivers: sortedDrivers.length,
      totalStops: stopsForReport.length,
      totalImages: totalImages,
    };

    console.log(`📄 PDF data prepared:`, {
      routeNumber: route.routeNumber,
      totalDrivers: sortedDrivers.length,
      totalStops: stopsForReport.length,
      totalImages: totalImages,
      drivers: sortedDrivers,
    });

    // Get the base URL for image access
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    console.log(`📄 Generating route image PDF with base URL: ${baseUrl}`);

    // Generate PDF
    const pdfBuffer = await generateRouteImagePDF(pdfData, baseUrl);

    console.log(`✅ PDF generated successfully. Size: ${pdfBuffer.length} bytes`);

    // Create filename with route number and date
    const routeDate = new Date(route.date).toISOString().split('T')[0]; // YYYY-MM-DD format
    // Sanitize filename: replace spaces with underscores to avoid URL encoding issues
    const safeRouteNumber = (route.routeNumber || 'unknown').replace(/\s+/g, '_');
    const fileName = `Route_${safeRouteNumber}_${routeDate}${financialOnly ? "_Financial" : ""}.pdf`;

    console.log(`📄 PDF ready for download: ${fileName}`);

    // Write the PDF to a temp file in public/uploads/pdfs/ and return a
    // download URL instead of streaming 87MB+ through Next.js's response
    // pipeline, which silently stalls for large buffers in Next.js 15.
    const pdfDir = path.join(process.cwd(), "public", "uploads", "pdfs");
    await fs.mkdir(pdfDir, { recursive: true });
    const pdfPath = path.join(pdfDir, fileName);
    await fs.writeFile(pdfPath, pdfBuffer);

    console.log(`📄 PDF written to disk: ${pdfPath}`);

    // Return the public URL — nginx already serves /uploads/ as static files
    // When this is the financial-only report, also try to auto-trigger a
    // processing run in the EndDay_Workflow automation app so the user
    // doesn't have to manually upload the PDF there. This is best-effort:
    // if that app isn't running locally, we still return the PDF normally.
    let endDayWorkflow: { triggered: boolean; runIdSlug?: string; error?: string } = {
      triggered: false,
    };
    if (financialOnly) {
      endDayWorkflow = await triggerEndDayWorkflowRun({
        routeNumber: route.routeNumber || safeRouteNumber,
        runDate: routeDate,
        pdfBuffer,
        pdfFilename: fileName,
      });
    }

    return NextResponse.json({
      url: `/uploads/pdfs/${fileName}`,
      fileName,
      size: pdfBuffer.length,
      ...(financialOnly ? { endDayWorkflow } : {}),
    });

  } catch (error) {
    console.error("❌ Error generating route image PDF:", error);
    
    return NextResponse.json(
      { 
        message: "Failed to generate PDF",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * Best-effort trigger of a new run in the locally-hosted EndDay_Workflow
 * automation app (see EndDay_Workflow project) — equivalent to manually
 * uploading the PDF on its Upload screen and clicking "Start Processing".
 * Never throws: failures (e.g. the app isn't running) are reported back
 * in the response so the PDF generation itself is unaffected.
 */
async function triggerEndDayWorkflowRun({
  routeNumber,
  runDate,
  pdfBuffer,
  pdfFilename,
}: {
  routeNumber: string;
  runDate: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}): Promise<{ triggered: boolean; runIdSlug?: string; error?: string }> {
  const baseUrl = process.env.END_DAY_WORKFLOW_URL;
  if (!baseUrl) {
    return { triggered: false, error: "END_DAY_WORKFLOW_URL is not configured" };
  }

  try {
    const formData = new FormData();
    formData.append("route_number", routeNumber);
    formData.append("run_date", runDate); // YYYY-MM-DD, matches FastAPI's date_cls Form field
    formData.append(
      "pdf",
      new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" }),
      pdfFilename
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/runs`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`❌ EndDay_Workflow trigger failed (${response.status}): ${text}`);
      return { triggered: false, error: `EndDay_Workflow responded with ${response.status}` };
    }

    const data = await response.json();
    console.log(`✅ EndDay_Workflow run triggered: ${data.run_id_slug}`);
    return { triggered: true, runIdSlug: data.run_id_slug };
  } catch (error) {
    // Most common cause: the EndDay_Workflow app isn't running locally.
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`⚠️ Could not reach EndDay_Workflow at ${baseUrl}: ${message}`);
    return { triggered: false, error: message };
  }
}
