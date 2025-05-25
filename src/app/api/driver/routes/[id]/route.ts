import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/routes/[id] - Get a specific route with its stops for the driver
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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the route ID from the URL
    const routeParams = await params;
    const { id } = routeParams;

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

    // Get the route with its stops
    const route = await prisma.route.findFirst({
      where: {
        id,
        OR: [
          // Routes where the driver is the primary driver
          {
            driverId: decoded.id,
            isDeleted: false,
          },
          // Routes where the driver is assigned to stops
          {
            stops: {
              some: {
                driverNameFromUpload: driverName,
                isDeleted: false,
              },
            },
            isDeleted: false,
          },
        ],
      },
      include: {
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
              },
            },
            adminNotes: {
              where: {
                isDeleted: false,
              },
              orderBy: {
                createdAt: "desc",
              },
              select: {
                id: true,
                note: true,
                readByDriver: true,
                readByDriverAt: true,
                createdAt: true,
                admin: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
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
    console.error("Error fetching driver route:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/driver/routes/[id] - Update route status (driver can only update status)
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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the route ID from the URL
    const { id } = params;

    // Get the update data from the request body
    const data = await request.json();

    // Validate the data - drivers can only update status
    if (!data.status || !["IN_PROGRESS", "COMPLETED"].includes(data.status)) {
      return NextResponse.json(
        { message: "Invalid status. Must be IN_PROGRESS or COMPLETED" },
        { status: 400 }
      );
    }

    // Update the route
    const updatedRoute = await prisma.route.update({
      where: {
        id,
        driverId: decoded.id, // Ensure the route belongs to the driver
        isDeleted: false,
      },
      data: {
        status: data.status,
      },
    });

    return NextResponse.json(updatedRoute);
  } catch (error) {
    console.error("Error updating driver route:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
