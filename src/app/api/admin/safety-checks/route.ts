import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/safety-checks - Get all safety checks with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type") || undefined; // START_OF_DAY or END_OF_DAY
    const driverId = searchParams.get("driverId") || undefined;
    const routeId = searchParams.get("routeId") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // Build the where clause for filtering
    const where: any = {
      isDeleted: false,
    };

    if (type) {
      where.type = type;
    }

    if (driverId) {
      where.driverId = driverId;
    }

    if (routeId) {
      where.routeId = routeId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        // Add one day to include the end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt.lt = endDate;
      }
    }

    // Get safety checks with pagination
    const safetyChecks = await prisma.safetyCheck.findMany({
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
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.safetyCheck.count({ where });

    return NextResponse.json({
      safetyChecks,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching safety checks:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
