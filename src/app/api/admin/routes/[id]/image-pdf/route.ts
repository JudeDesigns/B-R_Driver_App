import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateRouteImagePDF } from "@/utils/routeImagePdfGenerator";

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

    console.log(`📄 Generating PDF for route: ${routeId}`);

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

    // Check if route has any images
    const totalImages = route.stops.reduce(
      (total, stop) => total + (stop.invoiceImageUrls?.length || 0),
      0
    );

    if (totalImages === 0) {
      return NextResponse.json(
        { message: "No images found for this route" },
        { status: 400 }
      );
    }

    // Group stops by driver name
    const stopsGroupedByDriver: Record<string, typeof route.stops> = {};
    
    for (const stop of route.stops) {
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
        date: route.date,
      },
      stopsGroupedByDriver: sortedStopsGroupedByDriver,
      totalDrivers: sortedDrivers.length,
      totalStops: route.stops.length,
      totalImages: totalImages,
    };

    console.log(`📄 PDF data prepared:`, {
      routeNumber: route.routeNumber,
      totalDrivers: sortedDrivers.length,
      totalStops: route.stops.length,
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
    const fileName = `Route_${route.routeNumber || 'unknown'}_${routeDate}.pdf`;

    console.log(`📄 PDF ready for download: ${fileName}`);

    // Return the PDF for download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
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
