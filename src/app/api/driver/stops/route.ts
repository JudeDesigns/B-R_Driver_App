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

    // NOTE: Safety-check enforcement happens when a driver opens a specific
    // stop's details (see /api/driver/stops/[id]), not at the list level.
    // Drivers should be able to view their stops list immediately; the
    // safety checklist is only required before they can act on a stop.

    // Find all stops assigned to this driver (exclude completed stops unless specifically requested)
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
