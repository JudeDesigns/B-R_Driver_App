import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/routes/[id]/closeout-assignment - List the per-driver
// end-of-route closeout (Warehouse/Jetro) assignments for this route.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routeId } = await params;

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const assignments = await prisma.routeCloseoutAssignment.findMany({
      where: { routeId },
      include: {
        driver: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    console.error("Error fetching route closeout assignments:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/routes/[id]/closeout-assignment - Assign or unassign the
// end-of-route closeout type (Warehouse/Jetro) for a driver on this route.
//
// Body: { driverId: string; type: "WAREHOUSE" | "JETRO" | null }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routeId } = await params;

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { driverId, type } = data;

    if (!driverId) {
      return NextResponse.json(
        { message: "driverId is required" },
        { status: 400 }
      );
    }

    if (type !== "WAREHOUSE" && type !== "JETRO" && type !== null) {
      return NextResponse.json(
        { message: "type must be one of WAREHOUSE, JETRO, or null" },
        { status: 400 }
      );
    }

    const driver = await prisma.user.findUnique({
      where: { id: driverId, role: "DRIVER", isDeleted: false },
    });

    if (!driver) {
      return NextResponse.json({ message: "Driver not found" }, { status: 404 });
    }

    if (type === null) {
      await prisma.routeCloseoutAssignment.deleteMany({
        where: { routeId, driverId },
      });

      return NextResponse.json({ removed: true });
    }

    const assignment = await prisma.routeCloseoutAssignment.upsert({
      where: { routeId_driverId: { routeId, driverId } },
      create: { routeId, driverId, type, assignedBy: decoded.id },
      update: { type, assignedBy: decoded.id },
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error updating route closeout assignment:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
