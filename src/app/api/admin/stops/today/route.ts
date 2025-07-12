import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { getTodayStartUTC, getTodayEndUTC } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const driverFilter = searchParams.get("driver");
    const routeFilter = searchParams.get("route");



    // Get today's date range in PST timezone
    const startOfDay = getTodayStartUTC();
    const endOfDay = getTodayEndUTC();

    // Build where clause for routes
    const routeWhere: any = {
      date: {
        gte: startOfDay,
        lt: endOfDay,
      },
      isDeleted: false,
    };

    // Get driver info if filtering by driver
    let selectedDriver = null;
    if (driverFilter) {
      selectedDriver = await prisma.user.findUnique({
        where: {
          username: driverFilter,
          role: "DRIVER",
          isDeleted: false,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      });

      if (!selectedDriver) {
        console.log("Driver not found:", driverFilter);
        // If driver not found, return empty results
        return NextResponse.json({
          stops: [],
          drivers: [],
          routes: [],
        });
      }

      console.log("Selected driver:", selectedDriver);
    }

    // Add route filter if specified
    if (routeFilter) {
      routeWhere.id = routeFilter;
    }

    // Build stop filter - this is the main filter that determines which stops to return
    const stopWhere: any = {
      route: {
        ...routeWhere,
      },
      isDeleted: false,
    };

    // If driver filter is applied, filter stops by driver assignment
    if (selectedDriver) {
      stopWhere.OR = [
        // Stops assigned via driverNameFromUpload (exact username match)
        { driverNameFromUpload: selectedDriver.username },
        // Also check by full name if it exists
        ...(selectedDriver.fullName ? [{ driverNameFromUpload: selectedDriver.fullName }] : []),
        // Stops on routes where this driver is the primary driver
        {
          route: {
            driverId: selectedDriver.id,
            ...routeWhere, // Include the date and other route filters
          },
        },
      ];
    }

    console.log("Stop query where clause:", JSON.stringify(stopWhere, null, 2));

    // Get today's stops with route and customer information
    const stops = await prisma.stop.findMany({
      where: stopWhere,
      select: {
        id: true,
        sequence: true,
        address: true,
        customerNameFromUpload: true,
        driverNameFromUpload: true,
        status: true,
        customer: {
          select: {
            id: true,
            name: true,
            groupCode: true,
          },
        },
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            driver: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        stopDocuments: {
          where: {
            isDeleted: false,
            document: {
              isDeleted: false, // Also filter out deleted documents
            },
          },
          include: {
            document: {
              select: {
                id: true,
                title: true,
                type: true,
                fileName: true,
                filePath: true, // Include filePath for document viewing
              },
            },
          },
        },
      },
      orderBy: [
        { route: { routeNumber: "asc" } },
        { sequence: "asc" },
      ],
    });

    // Get unique drivers for filtering
    const drivers = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        isDeleted: false,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
      },
      orderBy: {
        fullName: "asc",
      },
    });

    // Get today's routes for filtering
    const routes = await prisma.route.findMany({
      where: {
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        routeNumber: true,
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        routeNumber: "asc",
      },
    });

    // Add document count to each stop based on the filtered stopDocuments
    const stopsWithCount = stops.map(stop => ({
      ...stop,
      _count: {
        stopDocuments: stop.stopDocuments.length, // Count only the filtered documents
      },
    }));

    return NextResponse.json({
      stops: stopsWithCount,
      drivers,
      routes,
    });
  } catch (error) {
    console.error("Error fetching today's stops:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
