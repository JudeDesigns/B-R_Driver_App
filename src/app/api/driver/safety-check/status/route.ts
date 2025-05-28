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

    // Get all START_OF_DAY safety checks for the driver's routes
    const startOfDayChecks = await prisma.safetyCheck.findMany({
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

    // Get all END_OF_DAY safety checks for the driver's routes
    const endOfDayChecks = await prisma.safetyCheck.findMany({
      where: {
        routeId: {
          in: routeIds,
        },
        driverId: decoded.id,
        type: "END_OF_DAY",
        isDeleted: false,
      },
      select: {
        routeId: true,
      },
    });

    // Create a set of route IDs that have completed start-of-day checks
    const completedRouteIds = new Set(
      startOfDayChecks.map((check) => check.routeId)
    );

    // Create a set of route IDs that have completed end-of-day checks
    const completedEndOfDayRouteIds = new Set(
      endOfDayChecks.map((check) => check.routeId)
    );

    // Create a list of routes that need start-of-day safety checks
    const routesNeedingStartChecks = routeIds.filter(
      (routeId) => !completedRouteIds.has(routeId)
    );

    // Create a list of routes that need end-of-day safety checks
    // These are routes that have start-of-day checks but not end-of-day checks
    const routesNeedingEndChecks = routeIds.filter(
      (routeId) =>
        completedRouteIds.has(routeId) &&
        !completedEndOfDayRouteIds.has(routeId)
    );

    // Get details for routes needing start-of-day checks
    const routesNeedingStartDetails =
      routesNeedingStartChecks.length > 0
        ? await prisma.route.findMany({
            where: {
              id: {
                in: routesNeedingStartChecks,
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

    // Get details for routes needing end-of-day checks
    const routesNeedingEndDetails =
      routesNeedingEndChecks.length > 0
        ? await prisma.route.findMany({
            where: {
              id: {
                in: routesNeedingEndChecks,
              },
              isDeleted: false,
            },
            select: {
              id: true,
              routeNumber: true,
              date: true,
              status: true,
            },
          })
        : [];

    // Log detailed information for debugging in development only
    if (process.env.NODE_ENV !== "production") {
      console.log("Safety check status API response:", {
        allRouteIds: routeIds,
        completedStartOfDayIds: Array.from(completedRouteIds),
        completedEndOfDayIds: Array.from(completedEndOfDayRouteIds),
        routesNeedingStartChecks: routesNeedingStartChecks,
        routesNeedingEndChecks: routesNeedingEndChecks,
      });
    }

    return NextResponse.json({
      hasCompletedChecks: routesNeedingStartChecks.length === 0,
      completedRouteIds: Array.from(completedRouteIds),
      completedEndOfDayRouteIds: Array.from(completedEndOfDayRouteIds),
      routesNeedingChecks: routesNeedingStartDetails,
      routesNeedingEndOfDayChecks: routesNeedingEndDetails,
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
