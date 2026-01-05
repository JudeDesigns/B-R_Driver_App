import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/routes/[id]/assigned-stops - Get stops assigned to the driver for a specific route
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
    const id = routeParams.id;

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

    // Get the route with stops assigned to this driver
    const route = await prisma.route.findUnique({
      where: {
        id,
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
        stops: {
          where: {
            OR: [
              { driverNameFromUpload: driverName },
              {
                AND: [
                  { driverNameFromUpload: null },
                  { route: { driverId: decoded.id } },
                ],
              },
            ],
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
                paymentTerms: true,
              },
            },
            adminNotes: {
              where: {
                isDeleted: false,
              },
              include: {
                admin: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ message: "Route not found" }, { status: 404 });
    }

    // Check if the driver has access to this route
    const isDriverAssigned =
      route.driverId === decoded.id || route.stops.length > 0;

    if (!isDriverAssigned) {
      return NextResponse.json(
        { message: "You do not have access to this route" },
        { status: 403 }
      );
    }

    // Check if safety check is completed for this route
    const safetyCheck = await prisma.safetyCheck.findFirst({
      where: {
        route: {
          id: id,
        },
        driver: {
          id: decoded.id,
        },
        type: "START_OF_DAY",
        isDeleted: false,
      },
    });

    return NextResponse.json({
      ...route,
      safetyCheckCompleted: !!safetyCheck,
    });
  } catch (error) {
    console.error("Error fetching route details:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
