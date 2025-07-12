import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { generateRouteImageArchiveZIP } from "@/utils/routeImageArchiveGenerator";
import path from "path";
import { promises as fs } from "fs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication and admin access
    const decoded = await verifyToken(request);
    if (!decoded) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    // Only Admin and Super Admin can generate image reports
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }

    const routeId = await params.id;

    // Get the route with all stops and their images
    const route = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        stops: {
          where: {
            isDeleted: false,
            // We'll filter stops with images after the query
          },
          orderBy: {
            sequence: "asc",
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
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

    // Filter stops that have images
    const stopsWithImages = route.stops.filter(stop =>
      stop.invoiceImageUrls && stop.invoiceImageUrls.length > 0
    );

    // Check if route has any images
    const totalImages = stopsWithImages.reduce((total, stop) => total + stop.invoiceImageUrls.length, 0);
    
    if (totalImages === 0) {
      return NextResponse.json(
        { message: "No images found for this route" },
        { status: 400 }
      );
    }

    // Group stops by driver
    const stopsGroupedByDriver: Record<string, typeof stopsWithImages> = {};

    stopsWithImages.forEach((stop) => {
      const driverName = stop.driverNameFromUpload || route.driver?.fullName || route.driver?.username || "Unknown Driver";
      if (!stopsGroupedByDriver[driverName]) {
        stopsGroupedByDriver[driverName] = [];
      }
      stopsGroupedByDriver[driverName].push(stop);
    });

    // Sort stops within each driver group by sequence
    Object.keys(stopsGroupedByDriver).forEach((driverName) => {
      stopsGroupedByDriver[driverName].sort((a, b) => a.sequence - b.sequence);
    });

    console.log(`📊 Route ${route.routeNumber}: Found ${Object.keys(stopsGroupedByDriver).length} drivers with ${route.stops.length} stops and ${totalImages} images`);

    // Prepare data for PDF generation
    const reportData = {
      route: {
        id: route.id,
        routeNumber: route.routeNumber || "N/A",
        date: route.date,
      },
      stopsGroupedByDriver,
      totalDrivers: Object.keys(stopsGroupedByDriver).length,
      totalStops: stopsWithImages.length,
      totalImages,
    };

    // Get the base URL for image access
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    console.log(`📦 Generating route image archive ZIP with base URL: ${baseUrl}`);

    // Generate ZIP archive
    const zipBuffer = await generateRouteImageArchiveZIP(reportData, baseUrl);

    console.log(`✅ ZIP archive generated successfully. Size: ${zipBuffer.length} bytes`);

    // Create filename with route number and date
    const routeDate = new Date(route.date).toISOString().split('T')[0]; // YYYY-MM-DD format
    const fileName = `route-${route.routeNumber || 'unknown'}-${routeDate}-image-archive.zip`;

    // Schedule image cleanup after 3 days (72 hours)
    // Store cleanup info in a simple JSON file (no schema changes needed)
    const cleanupInfo = {
      routeId: route.id,
      routeNumber: route.routeNumber,
      scheduledCleanup: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      imageUrls: stopsWithImages.flatMap(stop => stop.invoiceImageUrls),
      canCancel: true,
      archived: true,
      archivedAt: new Date().toISOString(),
      archivedBy: decoded.id
    };

    // Save cleanup schedule to a JSON file
    const cleanupDir = path.join(process.cwd(), "data", "cleanup-schedule");
    try {
      await fs.mkdir(cleanupDir, { recursive: true });
      const cleanupFile = path.join(cleanupDir, `route-${route.id}-cleanup.json`);
      await fs.writeFile(cleanupFile, JSON.stringify(cleanupInfo, null, 2));
      console.log(`📅 Cleanup scheduled for route ${route.routeNumber} in 3 days`);
    } catch (error) {
      console.warn("Failed to schedule cleanup:", error);
    }

    console.log(`💾 ZIP archive ready for download`);

    // Return the ZIP for download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error("Error generating route image report:", error);
    return NextResponse.json(
      { message: "Failed to generate image report" },
      { status: 500 }
    );
  }
}
