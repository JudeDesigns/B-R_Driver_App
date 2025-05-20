import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/routes/active - Get active routes for the driver
export async function GET(request: NextRequest) {
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

    // Get active routes for the driver
    const routes = await prisma.route.findMany({
      where: {
        isDeleted: false,
        status: {
          in: ["PENDING", "IN_PROGRESS"],
        },
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
      },
      orderBy: {
        date: "desc",
      },
      include: {
        stops: {
          where: {
            isDeleted: false,
          },
          select: {
            id: true,
            sequence: true,
            status: true,
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

    return NextResponse.json(routes);
  } catch (error) {
    console.error("Error fetching active routes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
