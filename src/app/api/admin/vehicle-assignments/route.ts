import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/admin/vehicle-assignments
 * Get all vehicle assignments with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicleId");
    const driverId = searchParams.get("driverId");
    const routeId = searchParams.get("routeId");
    const isActive = searchParams.get("isActive");

    // Build query
    const where: any = {
      isDeleted: false,
    };

    if (vehicleId) where.vehicleId = vehicleId;
    if (driverId) where.driverId = driverId;
    if (routeId) where.routeId = routeId;
    if (isActive !== null) where.isActive = isActive === "true";

    // Fetch assignments
    const assignments = await prisma.vehicleAssignment.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            vehicleNumber: true,
            make: true,
            model: true,
            status: true,
          },
        },
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
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
      orderBy: {
        assignedAt: "desc",
      },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching vehicle assignments:", error);
    return NextResponse.json(
      { message: "Failed to fetch vehicle assignments" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/vehicle-assignments
 * Create a new vehicle assignment
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.vehicleId || !data.driverId) {
      return NextResponse.json(
        { message: "Vehicle ID and Driver ID are required" },
        { status: 400 }
      );
    }

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: data.vehicleId },
    });

    if (!vehicle || vehicle.isDeleted) {
      return NextResponse.json(
        { message: "Vehicle not found" },
        { status: 404 }
      );
    }

    // Check if driver exists
    const driver = await prisma.user.findUnique({
      where: { id: data.driverId },
    });

    if (!driver || driver.isDeleted || driver.role !== "DRIVER") {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

    // If routeId provided, check if route exists
    if (data.routeId) {
      const route = await prisma.route.findUnique({
        where: { id: data.routeId },
      });

      if (!route || route.isDeleted) {
        return NextResponse.json(
          { message: "Route not found" },
          { status: 404 }
        );
      }
    }

    // Create assignment
    const assignment = await prisma.vehicleAssignment.create({
      data: {
        vehicleId: data.vehicleId,
        driverId: data.driverId,
        routeId: data.routeId || null,
        assignedBy: decoded.id,
        isActive: data.isActive !== undefined ? data.isActive : true,
        notes: data.notes || null,
      },
      include: {
        vehicle: true,
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        route: true,
      },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle assignment:", error);
    return NextResponse.json(
      { message: "Failed to create vehicle assignment" },
      { status: 500 }
    );
  }
}

