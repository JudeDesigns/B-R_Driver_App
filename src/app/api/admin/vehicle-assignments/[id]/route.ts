import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * PATCH /api/admin/vehicle-assignments/[id]
 * Update a vehicle assignment (typically to deactivate)
 */
export async function PATCH(
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

    if (!decoded || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const data = await request.json();

    // Check if assignment exists
    const existing = await prisma.vehicleAssignment.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }

    // Update assignment
    const assignment = await prisma.vehicleAssignment.update({
      where: { id },
      data: {
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
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

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Error updating vehicle assignment:", error);
    return NextResponse.json(
      { message: "Failed to update vehicle assignment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/vehicle-assignments/[id]
 * Soft delete a vehicle assignment
 */
export async function DELETE(
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

    if (!decoded || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Check if assignment exists
    const existing = await prisma.vehicleAssignment.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      return NextResponse.json(
        { message: "Assignment not found" },
        { status: 404 }
      );
    }

    // Soft delete assignment
    await prisma.vehicleAssignment.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false,
      },
    });

    return NextResponse.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("Error deleting vehicle assignment:", error);
    return NextResponse.json(
      { message: "Failed to delete vehicle assignment" },
      { status: 500 }
    );
  }
}

