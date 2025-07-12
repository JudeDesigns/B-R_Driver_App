import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// PATCH /api/admin/stops/[id]/reassign - Reassign a stop to a different driver
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: stopId } = await params;

  try {
    // Verify authentication
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

    // Get the reassignment data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.driverId) {
      return NextResponse.json(
        { message: "Driver ID is required" },
        { status: 400 }
      );
    }

    // Check if the stop exists
    const existingStop = await prisma.stop.findUnique({
      where: {
        id: stopId,
        isDeleted: false,
      },
      include: {
        route: true,
      },
    });

    if (!existingStop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Get the new driver information
    const newDriver = await prisma.user.findUnique({
      where: {
        id: data.driverId,
        role: "DRIVER",
        isDeleted: false,
      },
    });

    if (!newDriver) {
      return NextResponse.json({ message: "Driver not found" }, { status: 404 });
    }

    // Update the stop with the new driver information
    const updatedStop = await prisma.stop.update({
      where: {
        id: stopId,
      },
      data: {
        driverNameFromUpload: newDriver.fullName || newDriver.username,
      },
      include: {
        customer: true,
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Stop reassigned successfully",
      stop: updatedStop,
      newDriver: {
        id: newDriver.id,
        username: newDriver.username,
        fullName: newDriver.fullName,
      },
    });
  } catch (error) {
    console.error("Error reassigning stop:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
