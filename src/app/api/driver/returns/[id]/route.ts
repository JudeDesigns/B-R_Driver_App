import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/returns/[id] - Get a specific return
export async function GET(
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN", "DRIVER"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the return ID from the URL
    const { id } = params;

    // Get the return
    const returnItem = await prisma.return.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        stop: {
          select: {
            id: true,
            customerNameFromUpload: true,
            route: {
              select: {
                id: true,
                driverId: true,
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!returnItem) {
      return NextResponse.json({ message: "Return not found" }, { status: 404 });
    }

    // Check if the user has access to this return
    if (
      decoded.role === "DRIVER" &&
      returnItem.stop.route.driverId !== decoded.id
    ) {
      return NextResponse.json(
        { message: "You don't have access to this return" },
        { status: 403 }
      );
    }

    return NextResponse.json(returnItem);
  } catch (error) {
    console.error("Error fetching return:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/driver/returns/[id] - Update a return
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN", "DRIVER"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the return ID from the URL
    const { id } = params;

    // Get the return to check if it exists and if the user has access
    const returnItem = await prisma.return.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        stop: {
          select: {
            id: true,
            route: {
              select: {
                id: true,
                driverId: true,
              },
            },
          },
        },
      },
    });

    if (!returnItem) {
      return NextResponse.json({ message: "Return not found" }, { status: 404 });
    }

    // Check if the user has access to this return
    if (
      decoded.role === "DRIVER" &&
      returnItem.stop.route.driverId !== decoded.id
    ) {
      return NextResponse.json(
        { message: "You don't have access to this return" },
        { status: 403 }
      );
    }

    // Get the update data from the request body
    const data = await request.json();

    // Update the return
    const updatedReturn = await prisma.return.update({
      where: {
        id,
      },
      data: {
        warehouseLocation: data.warehouseLocation,
        vendorCreditNum: data.vendorCreditNum,
      },
    });

    return NextResponse.json(updatedReturn);
  } catch (error) {
    console.error("Error updating return:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
