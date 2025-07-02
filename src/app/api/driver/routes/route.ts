import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getTodayStartUTC, getTodayEndUTC, getPSTDateString } from "@/lib/timezone";

// GET /api/driver/routes - Get routes for the logged-in driver
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
    
    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build the query
    const query: any = {
      where: {
        driverId: decoded.id,
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            stops: {
              where: {
                isDeleted: false,
              },
            },
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
      if (date === getPSTDateString()) {
        // For today's date, use PST timezone
        query.where.date = {
          gte: getTodayStartUTC(),
          lte: getTodayEndUTC(),
        };
      } else {
        // For other dates, use the provided date
        const dateObj = new Date(date);
        query.where.date = {
          gte: new Date(dateObj.setHours(0, 0, 0, 0)),
          lt: new Date(dateObj.setHours(23, 59, 59, 999)),
        };
      }
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
    console.error("Error fetching driver routes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
