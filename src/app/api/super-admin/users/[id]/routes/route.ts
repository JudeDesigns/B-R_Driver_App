import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

// GET - Paginated list of routes owned by a given driver (for the Driver Detail page)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Unauthorized: Super Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    );
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Same ownership rule as the stats endpoint: routes are owned by a driver
    // via Stop.driverNameFromUpload (username match), falling back to
    // Route.driverId only when a stop has no driverNameFromUpload set.
    const stopOwnershipFilter = {
      isDeleted: false,
      OR: [
        {
          driverNameFromUpload: {
            equals: user.username,
            mode: "insensitive" as const,
          },
        },
        { driverNameFromUpload: null, route: { is: { driverId: userId } } },
      ],
    };

    const routeWhere = {
      isDeleted: false,
      stops: { some: stopOwnershipFilter },
    };

    const [totalCount, routes] = await Promise.all([
      prisma.route.count({ where: routeWhere }),
      prisma.route.findMany({
        where: routeWhere,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          routeNumber: true,
          date: true,
          status: true,
          _count: {
            select: { stops: { where: stopOwnershipFilter } },
          },
        },
      }),
    ]);

    return NextResponse.json({
      routes: routes.map((r) => ({
        id: r.id,
        routeNumber: r.routeNumber,
        date: r.date,
        status: r.status,
        stopsCount: r._count.stops,
      })),
      totalCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error fetching driver routes:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
