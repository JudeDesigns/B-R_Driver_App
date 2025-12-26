import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  verifyPasswordConfirmation,
  createPasswordConfirmationErrorResponse,
} from "@/lib/passwordConfirmation";

/**
 * GET /api/admin/vehicles/[id]
 * Get a single vehicle by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Fetch vehicle
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        assignments: {
          where: {
            isDeleted: false,
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
                status: true,
              },
            },
          },
          orderBy: {
            assignedAt: "desc",
          },
        },
      },
    });

    if (!vehicle || vehicle.isDeleted) {
      return NextResponse.json(
        { message: "Vehicle not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return NextResponse.json(
      { message: "Failed to fetch vehicle" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/vehicles/[id]
 * Update a vehicle
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const data = await request.json();

    // Check if vehicle exists
    const existing = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      return NextResponse.json(
        { message: "Vehicle not found" },
        { status: 404 }
      );
    }

    // If updating vehicle number, check for duplicates
    if (data.vehicleNumber && data.vehicleNumber !== existing.vehicleNumber) {
      const duplicate = await prisma.vehicle.findUnique({
        where: { vehicleNumber: data.vehicleNumber },
      });

      if (duplicate && !duplicate.isDeleted && duplicate.id !== id) {
        return NextResponse.json(
          { message: "Vehicle number already exists" },
          { status: 409 }
        );
      }
    }

    // Update vehicle
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        vehicleNumber: data.vehicleNumber !== undefined ? data.vehicleNumber : undefined,
        make: data.make !== undefined ? data.make : undefined,
        model: data.model !== undefined ? data.model : undefined,
        year: data.year !== undefined ? (data.year ? parseInt(data.year) : null) : undefined,
        licensePlate: data.licensePlate !== undefined ? data.licensePlate : undefined,
        vin: data.vin !== undefined ? data.vin : undefined,
        fuelType: data.fuelType !== undefined ? data.fuelType : undefined,
        status: data.status !== undefined ? data.status : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      },
    });

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return NextResponse.json(
      { message: "Failed to update vehicle" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/vehicles/[id]
 * Soft delete a vehicle
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify password confirmation (includes authentication check)
    const passwordCheck = await verifyPasswordConfirmation(request);

    if (!passwordCheck.confirmed) {
      return createPasswordConfirmationErrorResponse(passwordCheck);
    }

    const decoded = {
      id: passwordCheck.userId,
      role: passwordCheck.userRole,
    };

    if (!["ADMIN", "SUPER_ADMIN"].includes(decoded.role as string)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if vehicle exists
    const existing = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        assignments: {
          where: {
            isDeleted: false,
            isActive: true,
          },
        },
      },
    });

    if (!existing || existing.isDeleted) {
      return NextResponse.json(
        { message: "Vehicle not found" },
        { status: 404 }
      );
    }

    // Check if vehicle has active assignments
    if (existing.assignments.length > 0) {
      return NextResponse.json(
        { message: "Cannot delete vehicle with active assignments. Please deactivate assignments first." },
        { status: 400 }
      );
    }

    // Soft delete vehicle
    await prisma.vehicle.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    return NextResponse.json(
      { message: "Failed to delete vehicle" },
      { status: 500 }
    );
  }
}

