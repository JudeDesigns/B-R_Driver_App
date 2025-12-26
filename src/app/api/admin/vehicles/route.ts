import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/admin/vehicles
 * Get all vehicles with optional filtering
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
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    // Build query
    const where: any = {
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { vehicleNumber: { contains: search, mode: "insensitive" } },
        { make: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { licensePlate: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch vehicles
    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        assignments: {
          where: {
            isDeleted: false,
            isActive: true,
          },
          include: {
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
              },
            },
          },
        },
        _count: {
          select: {
            assignments: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
      orderBy: {
        vehicleNumber: "asc",
      },
    });

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json(
      { message: "Failed to fetch vehicles" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/vehicles
 * Create a new vehicle
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
    if (!data.vehicleNumber) {
      return NextResponse.json(
        { message: "Vehicle number is required" },
        { status: 400 }
      );
    }

    // Check if vehicle number already exists
    const existing = await prisma.vehicle.findUnique({
      where: { vehicleNumber: data.vehicleNumber },
    });

    if (existing && !existing.isDeleted) {
      return NextResponse.json(
        { message: "Vehicle number already exists" },
        { status: 409 }
      );
    }

    // Create vehicle
    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleNumber: data.vehicleNumber,
        make: data.make || null,
        model: data.model || null,
        year: data.year ? parseInt(data.year) : null,
        licensePlate: data.licensePlate || null,
        vin: data.vin || null,
        fuelType: data.fuelType || "DIESEL",
        status: data.status || "ACTIVE",
        notes: data.notes || null,
      },
    });

    return NextResponse.json({ vehicle }, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return NextResponse.json(
      { message: "Failed to create vehicle" },
      { status: 500 }
    );
  }
}

