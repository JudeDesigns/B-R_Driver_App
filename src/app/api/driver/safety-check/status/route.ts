import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getTodayStartUTC, getTodayEndUTC, getPSTDateString } from "@/lib/timezone";

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

    // Build PST date filter
    let pstStartDate: Date | undefined;
    let pstEndDate: Date | undefined;

    if (date) {
      if (date === getPSTDateString()) {
        // For "today", use PST timezone-aware date range
        pstStartDate = getTodayStartUTC();
        pstEndDate = getTodayEndUTC();
      } else {
        // For other dates, create proper UTC boundaries
        pstStartDate = new Date(date + 'T00:00:00Z');
        pstEndDate = new Date(date + 'T23:59:59Z');
      }
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

    // Get all routes where the driver is either the primary driver or assigned to stops
    // Use more precise matching to prevent cross-driver safety check issues
    const driverRoutes = await prisma.route.findMany({
      where: {
        OR: [
          // Routes where the driver is the primary driver
          {
            driverId: decoded.id,
            isDeleted: false,
            ...(pstStartDate && pstEndDate
              ? {
                date: {
                  gte: pstStartDate,
                  lt: pstEndDate,
                },
              }
              : {}),
          },
          // Routes where the driver is assigned to stops - use exact matching
          {
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
            ...(pstStartDate && pstEndDate
              ? {
                date: {
                  gte: pstStartDate,
                  lt: pstEndDate,
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
          include: {
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
        driverId: decoded.id,
        driverUsername: driver.username,
        driverFullName: driver.fullName,
        allRouteIds: routeIds,
        completedStartOfDayIds: Array.from(completedRouteIds),
        completedEndOfDayIds: Array.from(completedEndOfDayRouteIds),
        routesNeedingStartChecks: routesNeedingStartChecks,
        routesNeedingEndChecks: routesNeedingEndChecks,
      });
    }

    // Fetch global vehicle assignment
    // Use the same more precise matching logic
    const globalVehicleAssignment = await prisma.vehicleAssignment.findFirst({
      where: {
        driverId: decoded.id,
        isActive: true,
        isDeleted: false,
        routeId: null,
      },
      include: {
        vehicle: true,
      },
    });

    // Inject global vehicle assignment into routesNeedingChecks if needed
    if (globalVehicleAssignment) {
      routesNeedingStartDetails.forEach((route) => {
        if (!route.vehicleAssignments || route.vehicleAssignments.length === 0) {
          if (!route.vehicleAssignments) {
            (route as any).vehicleAssignments = [];
          }
          (route.vehicleAssignments as any[]).push(globalVehicleAssignment);
        }
      });
    }

    const response = NextResponse.json({
      hasCompletedChecks: routesNeedingStartChecks.length === 0,
      completedRouteIds: Array.from(completedRouteIds),
      completedEndOfDayRouteIds: Array.from(completedEndOfDayRouteIds),
      routesNeedingChecks: routesNeedingStartDetails,
      routesNeedingEndOfDayChecks: routesNeedingEndDetails,
      allRouteIds: routeIds,
    });

    // Add cache control headers to prevent stale data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    console.error("Error checking safety check status:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
