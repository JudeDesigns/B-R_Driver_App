import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { emitRouteStatusUpdate } from "@/app/api/socketio/route";

// POST /api/driver/routes/[id]/complete - Complete a route
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get the route ID from the URL
    const routeParams = await params;
    const { id } = routeParams;

    // Check if the route exists and is assigned to the driver
    const route = await prisma.route.findFirst({
      where: {
        id,
        isDeleted: false,
        OR: [
          { driverId: decoded.id },
          {
            stops: {
              some: {
                driverNameFromUpload: {
                  equals: decoded.username,
                },
              },
            },
          },
        ],
      },
      include: {
        stops: {
          where: {
            isDeleted: false,
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json(
        { message: "Route not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Check if all stops are completed
    const pendingStops = route.stops.filter(
      (stop) => stop.status !== "COMPLETED" && stop.status !== "CANCELLED"
    );

    if (pendingStops.length > 0) {
      return NextResponse.json(
        {
          message: `Route cannot be completed. There are ${pendingStops.length} pending stops.`,
        },
        { status: 400 }
      );
    }

    // Update the route status to COMPLETED
    const updatedRoute = await prisma.route.update({
      where: {
        id,
      },
      data: {
        status: "COMPLETED",
      },
    });

    // Emit WebSocket event for route status update
    try {
      // Get driver info
      const driver = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { username: true, fullName: true },
      });

      emitRouteStatusUpdate({
        routeId: updatedRoute.id,
        status: "COMPLETED",
        driverId: decoded.id,
        driverName: driver?.fullName || driver?.username || "Unknown Driver",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error emitting WebSocket event:", error);
      // Continue execution even if WebSocket emission fails
    }

    return NextResponse.json({
      message: "Route completed successfully",
      route: updatedRoute,
    });
  } catch (error) {
    console.error("Error completing route:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
