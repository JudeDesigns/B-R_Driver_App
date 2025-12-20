import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/admin/drivers/locations
 * Get last known locations for all active drivers
 * 
 * Query Parameters:
 * - routeId: Filter by specific route (optional)
 * - activeOnly: Only show drivers with recent location updates (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Verify admin/super admin role
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { role: true },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");
    const activeOnly = searchParams.get("activeOnly") !== "false"; // Default true

    // Build where clause
    const where: any = {
      role: "DRIVER",
      isDeleted: false,
    };

    // Filter by active drivers (location updated in last 30 minutes)
    if (activeOnly) {
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);
      
      where.lastLocationUpdate = {
        gte: thirtyMinutesAgo,
      };
    }

    // Get drivers with their last known locations
    const drivers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        lastKnownLatitude: true,
        lastKnownLongitude: true,
        lastLocationUpdate: true,
        locationAccuracy: true,
        routes: routeId
          ? {
              where: {
                id: routeId,
                isDeleted: false,
              },
              select: {
                id: true,
                routeNumber: true,
                date: true,
                status: true,
              },
            }
          : undefined,
      },
      orderBy: {
        lastLocationUpdate: "desc",
      },
    });

    // Filter out drivers without location data
    const driversWithLocation = drivers.filter(
      (driver) =>
        driver.lastKnownLatitude !== null && driver.lastKnownLongitude !== null
    );

    // If filtering by route, only include drivers assigned to that route
    let filteredDrivers = driversWithLocation;
    if (routeId) {
      filteredDrivers = driversWithLocation.filter(
        (driver) => driver.routes && driver.routes.length > 0
      );
    }

    return NextResponse.json({
      drivers: filteredDrivers,
      count: filteredDrivers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching driver locations:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

