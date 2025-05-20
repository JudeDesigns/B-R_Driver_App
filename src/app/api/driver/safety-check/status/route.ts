import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/safety-check/status - Check if driver has completed any safety checks
export async function GET(request: NextRequest) {
  try {
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

    // Parse query parameters
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    // Build date filter
    let dateFilter = {};
    if (date) {
      const dateObj = new Date(date);
      dateFilter = {
        timestamp: {
          gte: new Date(dateObj.setHours(0, 0, 0, 0)),
          lt: new Date(dateObj.setHours(23, 59, 59, 999)),
        },
      };
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

    const driverName = driver.fullName || driver.username;

    // Get all routes where the driver is either the primary driver or assigned to stops
    const driverRoutes = await prisma.route.findMany({
      where: {
        OR: [
          // Routes where the driver is the primary driver
          {
            driverId: decoded.id,
            isDeleted: false,
            ...(date
              ? {
                  date: {
                    gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                    lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
                  },
                }
              : {}),
          },
          // Routes where the driver is assigned to stops
          {
            stops: {
              some: {
                driverNameFromUpload: driverName,
                isDeleted: false,
              },
            },
            isDeleted: false,
            ...(date
              ? {
                  date: {
                    gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
                    lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
                  },
                }
              : {}),
          },
        ],
      },
      select: {
        id: true,
      },
    });

    const routeIds = driverRoutes.map((route) => route.id);

    // Get all safety checks for the driver's routes
    const safetyChecks = await prisma.safetyCheck.findMany({
      where: {
        routeId: {
          in: routeIds,
        },
        driverId: decoded.id,
        type: "START_OF_DAY",
        isDeleted: false,
      },
      select: {
        routeId: true,
      },
    });

    // Create a set of route IDs that have completed safety checks
    const completedRouteIds = new Set(
      safetyChecks.map((check) => check.routeId)
    );

    // Create a list of routes that need safety checks
    const routesNeedingChecks = routeIds.filter(
      (routeId) => !completedRouteIds.has(routeId)
    );

    // Get details for routes needing checks
    const routesDetails =
      routesNeedingChecks.length > 0
        ? await prisma.route.findMany({
            where: {
              id: {
                in: routesNeedingChecks,
              },
              isDeleted: false,
            },
            select: {
              id: true,
              routeNumber: true,
              date: true,
            },
          })
        : [];

    return NextResponse.json({
      hasCompletedChecks: routesNeedingChecks.length === 0,
      completedRouteIds: Array.from(completedRouteIds),
      routesNeedingChecks: routesDetails,
      allRouteIds: routeIds,
    });
  } catch (error) {
    console.error("Error checking safety check status:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
