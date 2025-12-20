import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getTodayStartUTC, getTodayEndUTC, getPSTDateString, createPSTDateFromString, toPSTEndOfDay } from "@/lib/timezone";
import { requireActiveShift } from "@/lib/attendanceMiddleware";

// GET /api/driver/routes - Get routes for the logged-in driver
export async function GET(request: NextRequest) {
  try {
    // Check authentication and attendance status
    const attendanceCheck = await requireActiveShift(request);
    if (!attendanceCheck.allowed) {
      return NextResponse.json(
        attendanceCheck.error,
        { status: attendanceCheck.status || 403 }
      );
    }

    const decoded = attendanceCheck.decoded;

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
        // For other dates, use proper PST timezone conversion
        const startDate = createPSTDateFromString(date);
        const endDate = toPSTEndOfDay(startDate);
        query.where.date = {
          gte: startDate,
          lt: endDate,
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
