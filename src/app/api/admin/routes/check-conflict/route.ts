import { NextRequest, NextResponse } from "next/server";
import { parseRouteExcel } from "@/lib/routeParser";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    // Read the Excel file
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the Excel file to get route information
    const parseResult = await parseRouteExcel(buffer);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          message: "Failed to parse route data",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    const routeNumber = parseResult.route?.routeNumber;

    if (!routeNumber) {
      return NextResponse.json(
        { message: "No route number found in the file" },
        { status: 400 }
      );
    }

    // Check if a route with the same route number AND date already exists
    const routeDate = parseResult.route?.date;

    if (!routeDate) {
      return NextResponse.json(
        { message: "No route date found in the file" },
        { status: 400 }
      );
    }

    // Normalize the route date to start of day for consistent comparison
    const normalizedRouteDate = new Date(routeDate);
    normalizedRouteDate.setHours(0, 0, 0, 0);

    // Find existing route with same route number and date (within the same day)
    const startOfDay = new Date(normalizedRouteDate);
    const endOfDay = new Date(normalizedRouteDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingRoute = await prisma.route.findFirst({
      where: {
        routeNumber: routeNumber,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            stops: true,
          },
        },
      },
    });

    const response = {
      routeNumber,
      hasConflict: !!existingRoute,
      existingRoute: existingRoute
        ? {
            id: existingRoute.id,
            routeNumber: existingRoute.routeNumber,
            date: existingRoute.date,
            status: existingRoute.status,
            stopCount: existingRoute._count.stops,
            createdAt: existingRoute.createdAt,
            updatedAt: existingRoute.updatedAt,
          }
        : null,
      newRoute: {
        routeNumber: parseResult.route.routeNumber,
        date: parseResult.route.date,
        stopCount: parseResult.route.stops.length,
        driverSummary: parseResult.route.stops.reduce((acc, stop) => {
          acc[stop.driverName] = (acc[stop.driverName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
      parseResult: {
        rowsProcessed: parseResult.rowsProcessed,
        rowsSucceeded: parseResult.rowsSucceeded,
        rowsFailed: parseResult.rowsFailed,
        warnings: parseResult.warnings,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Route conflict check error:", error);
    return NextResponse.json(
      {
        message: `An error occurred during conflict check: ${
          (error as Error).message
        }`,
      },
      { status: 500 }
    );
  }
}
