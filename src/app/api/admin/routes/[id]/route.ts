import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/routes/[id] - Get a specific route with its stops
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN", "DRIVER"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the route ID from the URL - await the params object
    const routeParams = await params;
    const id = routeParams.id;

    // Get the route with its stops
    const route = await prisma.route.findUnique({
      where: {
        id,
        isDeleted: false,
        ...(decoded.role === "DRIVER" ? { driverId: decoded.id } : {}), // Drivers can only see their own routes
      },
      include: {
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        stops: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            sequence: "asc",
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                address: true,
                contactInfo: true,
                preferences: true,
                groupCode: true,
              },
            },
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ message: "Route not found" }, { status: 404 });
    }

    return NextResponse.json(route);
  } catch (error) {
    console.error("Error fetching route:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/routes/[id] - Update a route
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the route ID from the URL - await the params object
    const routeParams = await params;
    const id = routeParams.id;

    // Get the update data from the request body
    const data = await request.json();

    // Validate the data
    const allowedFields = ["routeNumber", "date", "status"];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (field in data) {
        updateData[field] = data[field];
      }
    }

    // Update the route
    const updatedRoute = await prisma.route.update({
      where: {
        id,
        isDeleted: false,
      },
      data: updateData,
    });

    return NextResponse.json(updatedRoute);
  } catch (error) {
    console.error("Error updating route:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/routes/[id] - Delete a route (soft delete)
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

    if (!decoded || !decoded.id || decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Unauthorized: Super Admin access required for route deletion" },
        { status: 403 }
      );
    }

    // Get the route ID from the URL - await the params object
    const routeParams = await params;
    const id = routeParams.id;

    // Soft delete the route
    await prisma.route.update({
      where: {
        id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });

    // Also soft delete all stops associated with this route
    await prisma.stop.updateMany({
      where: {
        routeId: id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({ message: "Route deleted successfully" });
  } catch (error) {
    console.error("Error deleting route:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
