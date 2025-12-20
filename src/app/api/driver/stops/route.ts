import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTodayStartUTC, getTodayEndUTC, getPSTDateString, createPSTDateFromString, toPSTStartOfDay, toPSTEndOfDay, debugTimezoneConversion } from "@/lib/timezone";
import { requireActiveShift } from "@/lib/attendanceMiddleware";

// GET /api/driver/stops - Get all stops assigned to the driver
export async function GET(request: NextRequest) {
  try {
    // Check authentication and attendance status
    const attendanceCheck = await requireActiveShift(request);
    if (!attendanceCheck.allowed) {
      return NextResponse.json(
        attendanceCheck.error,
        { status: attendanceCheck.status || 403 }
      );
    }

    const decoded = attendanceCheck.decoded;

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

    // Debug logging for date filtering
    if (date) {
      console.log(`[DRIVER STOPS API] Date filter requested: ${date}`);
      const todayPST = getPSTDateString();
      console.log(`[DRIVER STOPS API] Today in PST: ${todayPST}`);

      if (date === todayPST) {
        const startUTC = getTodayStartUTC();
        const endUTC = getTodayEndUTC();
        debugTimezoneConversion("Today Start UTC", startUTC);
        debugTimezoneConversion("Today End UTC", endUTC);
      } else {
        const startDate = createPSTDateFromString(date);
        const endDate = toPSTEndOfDay(startDate);
        debugTimezoneConversion(`Custom Date Start (${date})`, startDate);
        debugTimezoneConversion(`Custom Date End (${date})`, endDate);
      }
    }

    // SAFETY CHECK ENFORCEMENT: Get routes that have completed safety checks
    const completedSafetyCheckRoutes = await prisma.safetyCheck.findMany({
      where: {
        driverId: decoded.id,
        type: "START_OF_DAY",
        isDeleted: false,
        ...(date ? {
          route: {
            date: {
              gte: date === getPSTDateString() ? getTodayStartUTC() : createPSTDateFromString(date),
              lte: date === getPSTDateString() ? getTodayEndUTC() : toPSTEndOfDay(createPSTDateFromString(date)),
            },
          },
        } : {}),
      },
      select: {
        routeId: true,
      },
    });

    const safetyCompletedRouteIds = completedSafetyCheckRoutes.map(check => check.routeId);

    // Log safety check enforcement for debugging
    if (process.env.NODE_ENV !== "production") {
      console.log("Stops API - Safety Check Enforcement:", {
        driverId: decoded.id,
        driverUsername: driver.username,
        requestedDate: date,
        safetyCompletedRouteIds,
        safetyChecksFound: completedSafetyCheckRoutes.length,
      });
    }

    // Find all stops assigned to this driver (exclude completed stops unless specifically requested)
    // ONLY return stops from routes where safety checks have been completed
    const stops = await prisma.stop.findMany({
      where: {
        AND: [
          // Driver assignment check
          {
            OR: [
              { driverNameFromUpload: driver.username },
              ...(driver.fullName ? [{ driverNameFromUpload: driver.fullName }] : []),
              {
                AND: [
                  { driverNameFromUpload: null },
                  { route: { driverId: decoded.id } }
                ]
              }
            ],
          },
          // SAFETY CHECK ENFORCEMENT: Only show stops from routes with completed safety checks
          {
            routeId: {
              in: safetyCompletedRouteIds.length > 0 ? safetyCompletedRouteIds : [],
            },
          },
          // Other filters
          { isDeleted: false },
          // Hide completed stops from driver view unless specifically requested
          ...(status === "COMPLETED" ? [] : [{ status: { not: "COMPLETED" as any } }]),
          ...(date ? [{
            route: {
              date: {
                gte: date === getPSTDateString() ? getTodayStartUTC() : createPSTDateFromString(date),
                lte: date === getPSTDateString() ? getTodayEndUTC() : toPSTEndOfDay(createPSTDateFromString(date)),
              },
            },
          }] : []),
          ...(status ? [{ status: status as any }] : []),
        ],
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            address: true,
            contactInfo: true,
            preferences: true,
            groupCode: true,
          },
        },
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            status: true,
          },
        },
      },
      orderBy: [
        {
          route: {
            date: "asc",
          },
        },
        {
          sequence: "asc",
        },
      ],
    });

    return NextResponse.json({
      stops,
      count: stops.length,
    });
  } catch (error) {
    console.error("Error fetching driver stops:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
