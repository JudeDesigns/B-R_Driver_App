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

    // Find routes where this driver is assigned to stops
    // First, find all stops assigned to this driver
    const driverName = driver.fullName || driver.username;
    
    // Get routes where the driver is directly assigned
    const directlyAssignedRoutes = await prisma.route.findMany({
      where: {
        driverId: decoded.id,
        isDeleted: false,
        ...(date ? {
          date: {
            gte: date === getPSTDateString() ? getTodayStartUTC() : new Date(new Date(date).setHours(0, 0, 0, 0)),
            lte: date === getPSTDateString() ? getTodayEndUTC() : new Date(new Date(date).setHours(23, 59, 59, 999)),
          },
        } : {}),
        ...(status ? { status } : {}),
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
      },
    });
    
    // Get routes where the driver is assigned to stops via driverNameFromUpload
    const routesWithAssignedStops = await prisma.route.findMany({
      where: {
        stops: {
          some: {
            driverNameFromUpload: driverName,
            isDeleted: false,
          },
        },
        isDeleted: false,
        ...(date ? {
          date: {
            gte: date === getPSTDateString() ? getTodayStartUTC() : new Date(new Date(date).setHours(0, 0, 0, 0)),
            lte: date === getPSTDateString() ? getTodayEndUTC() : new Date(new Date(date).setHours(23, 59, 59, 999)),
          },
        } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        _count: {
          select: {
            stops: {
              where: {
                driverNameFromUpload: driverName,
                isDeleted: false,
              },
            },
          },
        },
      },
    });
    
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
    
    // Convert map to array and sort by date
    const allRoutes = Array.from(routeMap.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Apply pagination
    const paginatedRoutes = allRoutes.slice(offset, offset + limit);
    
    return NextResponse.json({
      routes: paginatedRoutes,
      totalCount: allRoutes.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching driver assigned routes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
