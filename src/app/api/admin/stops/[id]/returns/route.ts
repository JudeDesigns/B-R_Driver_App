import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/stops/[id]/returns - Get all returns for a stop (admin view)
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Verify authentication first
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

    // In Next.js 14, params is a Promise that needs to be awaited
    const params = await context.params;
    const { id } = params;

    // We already extracted the ID from context.params above
    // const { id } = await params;

    // Check if the stop exists
    const stop = await prisma.stop.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        route: {
          select: {
            routeNumber: true,
            date: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Get all returns for the stop
    const returns = await prisma.return.findMany({
      where: {
        stopId: id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      stop,
      returns,
    });
  } catch (error) {
    console.error("Error fetching returns:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
