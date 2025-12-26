import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getTodayStartUTC, getTodayEndUTC, getPSTDateString } from "@/lib/timezone";


// GET /api/driver/assigned-routes - Get routes where the driver is assigned to stops
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the driver's username
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

    // Parse query parameters
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Prepare date filter
    let dateFilter = {};
    if (date) {
      if (date === getPSTDateString()) {
        // For "today", use PST timezone-aware date range
        dateFilter = {
          date: {
            gte: getTodayStartUTC(),
            lt: getTodayEndUTC(),
          },
        };
      } else {
        // For other dates, use the provided date
        dateFilter = {
          date: {
            gte: new Date(date + 'T00:00:00Z'),
            lt: new Date(date + 'T23:59:59Z'),
          },
        };
      }
    }

    // Prepare status filter
    const statusFilter = status ? { status: status as any } : {};

    // Get routes where the driver is directly assigned
    const directlyAssignedRoutes = await prisma.route.findMany({
      where: {
        driverId: decoded.id,
        isDeleted: false,
        ...dateFilter,
        ...statusFilter,
      },
      include: {
        _count: {
          select: {
            stops: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
        vehicleAssignments: {
          where: {
            driverId: decoded.id,
            isActive: true,
            isDeleted: false,
          },
          include: {
            vehicle: true,
          },
        },
      },
    });

    // Get routes where the driver is assigned to stops via driverNameFromUpload
    // Use precise matching to prevent cross-driver issues
    const routesWithAssignedStops = await prisma.route.findMany({
      where: {
        stops: {
          some: {
            OR: [
              // Match by exact username
              { driverNameFromUpload: driver.username },
              // Match by exact full name if it exists
              ...(driver.fullName ? [{ driverNameFromUpload: driver.fullName }] : []),
            ],
            isDeleted: false,
          },
        },
        isDeleted: false,
        ...dateFilter,
        ...statusFilter,
      },
      include: {
        _count: {
          select: {
            stops: {
              where: {
                OR: [
                  { driverNameFromUpload: driver.username },
                  ...(driver.fullName ? [{ driverNameFromUpload: driver.fullName }] : []),
                ],
                isDeleted: false,
              },
            },
          },
        },
        vehicleAssignments: {
          where: {
            driverId: decoded.id,
            isActive: true,
            isDeleted: false,
          },
          include: {
            vehicle: true,
          },
        },
      },
    });

    // Get routes where the driver is assigned via vehicle assignment
    // First, find active vehicle assignments for this driver
    const vehicleAssignments = await prisma.vehicleAssignment.findMany({
      where: {
        driverId: decoded.id,
        isActive: true,
        isDeleted: false,
        routeId: { not: null }, // Only assignments with specific routes
      },
      select: {
        routeId: true,
      },
    });

    const routeIdsFromVehicles = vehicleAssignments
      .map(a => a.routeId)
      .filter((id): id is string => id !== null);

    // Fetch those routes if any exist
    const routesViaVehicleAssignment = routeIdsFromVehicles.length > 0
      ? await prisma.route.findMany({
        where: {
          id: { in: routeIdsFromVehicles },
          isDeleted: false,
          ...dateFilter,
          ...statusFilter,
        },
        include: {
          _count: {
            select: {
              stops: {
                where: {
                  isDeleted: false,
                },
              },
            },
          },
          vehicleAssignments: {
            where: {
              driverId: decoded.id,
              isActive: true,
              isDeleted: false,
            },
            include: {
              vehicle: true,
            },
          },
        },
      })
      : [];

    // Combine and deduplicate routes
    const routeMap = new Map();

    // Add directly assigned routes
    directlyAssignedRoutes.forEach(route => {
      routeMap.set(route.id, route);
    });

    // Add routes with assigned stops
    routesWithAssignedStops.forEach(route => {
      if (!routeMap.has(route.id)) {
        routeMap.set(route.id, route);
      }
    });

    // Add routes via vehicle assignment
    routesViaVehicleAssignment.forEach(route => {
      if (!routeMap.has(route.id)) {
        routeMap.set(route.id, route);
      }
    });

    // Convert map to array and sort by date
    const allRoutes = Array.from(routeMap.values()).sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Log detailed information for debugging in development only
    if (process.env.NODE_ENV !== "production") {
      console.log("Assigned routes API response:", {
        driverId: decoded.id,
        driverUsername: driver.username,
        driverFullName: driver.fullName,
        requestedDate: date,
        directlyAssignedCount: directlyAssignedRoutes.length,
        stopAssignedCount: routesWithAssignedStops.length,
        totalRoutesFound: allRoutes.length,
        routeDates: allRoutes.map(r => ({ id: r.id, date: r.date, routeNumber: r.routeNumber })),
      });
    }

    // Apply pagination
    const paginatedRoutes = allRoutes.slice(offset, offset + limit);

    const response = NextResponse.json({
      routes: paginatedRoutes,
      totalCount: allRoutes.length,
      limit,
      offset,
    });

    // Add cache control headers to prevent stale data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error("Error fetching driver assigned routes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
