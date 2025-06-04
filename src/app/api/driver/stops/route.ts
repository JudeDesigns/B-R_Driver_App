import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/stops - Get all stops assigned to the driver
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

    const driverName = driver.fullName || driver.username;

    // Find all stops assigned to this driver (exclude completed stops unless specifically requested)
    const stops = await prisma.stop.findMany({
      where: {
        OR: [
          { driverNameFromUpload: driverName },
          {
            AND: [
              { driverNameFromUpload: null },
              { route: { driverId: decoded.id } }
            ]
          }
        ],
        isDeleted: false,
        // Hide completed stops from driver view unless specifically requested
        ...(status === "COMPLETED" ? {} : { status: { not: "COMPLETED" } }),
        ...(date ? {
          route: {
            date: {
              gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
              lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
            },
          },
        } : {}),
        ...(status ? { status } : {}),
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
