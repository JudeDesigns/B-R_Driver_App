import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { emitDriverLocationUpdate } from "@/app/api/socketio/route";

// POST /api/driver/location - Update driver location
export async function POST(request: NextRequest) {
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

    // Get the location data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.latitude || !data.longitude || !data.stopId || !data.routeId) {
      return NextResponse.json(
        { message: "Missing required location data" },
        { status: 400 }
      );
    }

    // Get the driver's username for access verification
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

    // Check if the stop exists and belongs to the driver
    const stop = await prisma.stop.findFirst({
      where: {
        id: data.stopId,
        isDeleted: false,
        route: {
          id: data.routeId,
          OR: [
            { driverId: decoded.id },
            {
              stops: {
                some: {
                  OR: [
                    { driverNameFromUpload: driver.username },
                    { driverNameFromUpload: driver.fullName },
                  ],
                },
              },
            },
          ],
          isDeleted: false,
        },
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        route: {
          select: {
            routeNumber: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Store the location update in the database
    const locationUpdate = await prisma.driverLocation.create({
      data: {
        driverId: decoded.id,
        stopId: data.stopId,
        routeId: data.routeId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy || null,
        timestamp: new Date(),
      },
    });

    // Emit location update event
    emitDriverLocationUpdate({
      driverId: decoded.id,
      driverName: driver?.fullName || driver?.username || "Unknown Driver",
      stopId: data.stopId,
      routeId: data.routeId,
      customerName: stop.customer.name,
      routeNumber: stop.route.routeNumber,
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy || null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      message: "Location updated successfully",
      locationUpdate,
    });
  } catch (error) {
    console.error("Error updating driver location:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
