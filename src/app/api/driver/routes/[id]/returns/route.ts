import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/routes/[id]/returns - Get all returns for a route
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

    // Get the route ID from the URL
    const { id } = params;

    // Check if the route exists and is assigned to the driver (if driver role)
    const route = await prisma.route.findFirst({
      where: {
        id,
        isDeleted: false,
        ...(decoded.role === "DRIVER" ? {
          OR: [
            { driverId: decoded.id },
            {
              stops: {
                some: {
                  driverNameFromUpload: {
                    equals: decoded.username,
                  },
                },
              },
            },
          ],
        } : {}),
      },
      include: {
        stops: {
          where: {
            isDeleted: false,
          },
          select: {
            id: true,
            sequence: true,
            customerNameFromUpload: true,
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

    if (!route) {
      return NextResponse.json(
        { message: "Route not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Get all returns for the route's stops
    const stopIds = route.stops.map((stop) => stop.id);
    
    const returns = await prisma.return.findMany({
      where: {
        stopId: {
          in: stopIds,
        },
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        stop: {
          select: {
            customerNameFromUpload: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(returns);
  } catch (error) {
    console.error("Error fetching route returns:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
