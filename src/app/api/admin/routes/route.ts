import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { createPSTDateFromString, toPSTEndOfDay } from "@/lib/timezone";

// GET /api/admin/routes - Get all routes
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;
    
    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN", "DRIVER"].includes(decoded.role)) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const driverId = url.searchParams.get("driverId");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build the query
    const query: any = {
      where: {
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
        _count: {
          select: {
            stops: true,
          },
        },
      },
      orderBy: {
        date: "desc" as const,
      },
      take: limit,
      skip: offset,
    };

    // Add filters based on query parameters
    if (date) {
      // Use proper PST timezone conversion for date filtering
      const startDate = createPSTDateFromString(date);
      const endDate = toPSTEndOfDay(startDate);
      query.where.date = {
        gte: startDate,
        lt: endDate,
      };

      // Debug logging for admin route date filtering
      console.log(`[ADMIN ROUTES API] Date filter: ${date}`, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startPST: startDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        endPST: endDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
      });
    }

    if (driverId) {
      query.where.driverId = driverId;
    } else if (decoded.role === "DRIVER") {
      // Drivers can only see their own routes
      query.where.driverId = decoded.id;
    }

    if (status) {
      query.where.status = status;
    }

    // Get the routes
    const routes = await prisma.route.findMany(query);

    // Get the total count
    const totalCount = await prisma.route.count({
      where: query.where,
    });

    return NextResponse.json({
      routes,
      totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching routes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
