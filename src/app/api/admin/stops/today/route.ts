import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

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

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Build where clause for routes
    const routeWhere: any = {
      date: {
        gte: startOfDay,
        lt: endOfDay,
      },
      isDeleted: false,
    };

    // Add driver filter if specified
    if (driverFilter) {
      routeWhere.OR = [
        { driverId: driverFilter },
        {
          stops: {
            some: {
              driverNameFromUpload: driverFilter,
            },
          },
        },
      ];
    }

    // Add route filter if specified
    if (routeFilter) {
      routeWhere.id = routeFilter;
    }

    // Get today's stops with route and customer information
    const stops = await prisma.stop.findMany({
      where: {
        route: routeWhere,
        isDeleted: false,
      },
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
          },
          include: {
            document: {
              select: {
                id: true,
                title: true,
                type: true,
                fileName: true,
              },
            },
          },
        },
        _count: {
          select: {
            stopDocuments: true,
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

    return NextResponse.json({
      stops,
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
