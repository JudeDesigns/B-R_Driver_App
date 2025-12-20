import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/admin/safety-declarations
 * Get all safety declarations with filtering
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");
    const routeId = searchParams.get("routeId");
    const declarationType = searchParams.get("declarationType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query
    const where: any = {
      isDeleted: false,
    };

    if (driverId) where.driverId = driverId;
    if (routeId) where.routeId = routeId;
    if (declarationType) where.declarationType = declarationType;

    if (startDate || endDate) {
      where.acknowledgedAt = {};
      if (startDate) where.acknowledgedAt.gte = new Date(startDate);
      if (endDate) where.acknowledgedAt.lte = new Date(endDate);
    }

    // Fetch declarations
    const declarations = await prisma.safetyDeclaration.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            status: true,
          },
        },
      },
      orderBy: {
        acknowledgedAt: "desc",
      },
    });

    return NextResponse.json({ declarations });
  } catch (error) {
    console.error("Error fetching safety declarations:", error);
    return NextResponse.json(
      { message: "Failed to fetch safety declarations" },
      { status: 500 }
    );
  }
}

