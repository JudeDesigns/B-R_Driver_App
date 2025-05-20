import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// POST /api/driver/safety-check - Submit a safety check
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

    // Parse request body
    const body = await request.json();
    const { routeId, type, details } = body;

    if (!routeId || !type) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if the route exists and the driver has access to it
    const route = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        stops: {
          where: {
            isDeleted: false,
          },
          select: {
            driverNameFromUpload: true,
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ message: "Route not found" }, { status: 404 });
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

    const driverName = driver.fullName || driver.username;

    // Check if the driver is assigned to this route
    const isDriverAssigned =
      route.driverId === decoded.id ||
      route.stops.some((stop) => stop.driverNameFromUpload === driverName);

    if (!isDriverAssigned) {
      return NextResponse.json(
        { message: "You are not assigned to this route" },
        { status: 403 }
      );
    }

    // Check if a safety check already exists for this route and driver
    const existingSafetyCheck = await prisma.safetyCheck.findFirst({
      where: {
        routeId,
        driverId: decoded.id,
        type,
        isDeleted: false,
      },
    });

    if (existingSafetyCheck) {
      return NextResponse.json(
        { message: "Safety check already submitted for this route" },
        { status: 400 }
      );
    }

    // Create the safety check with the correct format
    const safetyCheck = await prisma.$transaction(async (tx) => {
      // First, check if the route exists
      const routeExists = await tx.route.findUnique({
        where: { id: routeId },
      });

      if (!routeExists) {
        throw new Error("Route not found");
      }

      // Then create the safety check
      return await tx.safetyCheck.create({
        data: {
          type,
          responses: details || {},
          timestamp: new Date(),
          route: {
            connect: { id: routeId },
          },
          driver: {
            connect: { id: decoded.id },
          },
        },
      });
    });

    // If this is a start of day safety check and the route is pending, update it to in progress
    if (type === "START_OF_DAY" && route.status === "PENDING") {
      await prisma.route.update({
        where: {
          id: routeId,
        },
        data: {
          status: "IN_PROGRESS",
        },
      });
    }

    return NextResponse.json({
      message: "Safety check submitted successfully",
      safetyCheck,
    });
  } catch (error) {
    console.error("Error submitting safety check:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
