import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getTodayStartUTC, getTodayEndUTC, toPSTStartOfDay, toPSTEndOfDay } from "@/lib/timezone";

// GET /api/admin/kpis - Fetch KPI data with filters
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const period = searchParams.get("period"); // 'daily', 'weekly', 'monthly'

    // Build where clause
    const where: any = {
      isDeleted: false,
    };

    if (driverId) {
      where.driverId = driverId;
    }

    // Handle date filtering (all dates in PST timezone)
    if (startDate && endDate) {
      where.date = {
        gte: toPSTStartOfDay(new Date(startDate)),
        lte: toPSTEndOfDay(new Date(endDate)),
      };
    } else if (period) {
      switch (period) {
        case "daily":
          // Get today in PST timezone
          where.date = {
            gte: getTodayStartUTC(),
            lt: getTodayEndUTC(),
          };
          break;
        case "weekly":
          // Get start of week in PST timezone
          const todayStart = getTodayStartUTC();
          const weekStart = new Date(todayStart);
          const dayOfWeek = new Date(todayStart).toLocaleDateString("en-US", {
            timeZone: "America/Los_Angeles",
            weekday: "long"
          });
          const daysToSubtract = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(dayOfWeek);
          weekStart.setDate(weekStart.getDate() - daysToSubtract);
          where.date = {
            gte: toPSTStartOfDay(weekStart),
            lt: new Date(toPSTStartOfDay(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000),
          };
          break;
        case "monthly":
          // Get start of month in PST timezone
          const now = new Date();
          const pstDateString = now.toLocaleDateString("en-CA", {
            timeZone: "America/Los_Angeles"
          });
          const [year, month] = pstDateString.split('-').map(Number);
          const monthStart = toPSTStartOfDay(new Date(`${year}-${month.toString().padStart(2, '0')}-01`));
          const nextMonth = month === 12 ? 1 : month + 1;
          const nextYear = month === 12 ? year + 1 : year;
          const monthEnd = toPSTStartOfDay(new Date(`${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`));
          where.date = {
            gte: monthStart,
            lt: monthEnd,
          };
          break;
      }
    }

    // Fetch KPI data
    const kpis = await prisma.dailyKPI.findMany({
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
      orderBy: {
        date: "desc",
      },
    });

    // Calculate aggregated statistics
    const stats = {
      totalMilesDriven: kpis.reduce((sum, kpi) => sum + (kpi.milesDriven || 0), 0),
      totalDelivered: kpis.reduce((sum, kpi) => sum + kpi.totalDelivered, 0),
      totalStopsCompleted: kpis.reduce((sum, kpi) => sum + kpi.stopsCompleted, 0),
      totalStopsAssigned: kpis.reduce((sum, kpi) => sum + kpi.stopsTotal, 0),
      totalTimeMinutes: kpis.reduce((sum, kpi) => sum + (kpi.totalTime || 0), 0),
      averageMilesPerDay: kpis.length > 0
        ? kpis.reduce((sum, kpi) => sum + (kpi.milesDriven || 0), 0) / kpis.length
        : 0,
      averageDeliveredPerDay: kpis.length > 0
        ? kpis.reduce((sum, kpi) => sum + kpi.totalDelivered, 0) / kpis.length
        : 0,
      completionRate: kpis.reduce((sum, kpi) => sum + kpi.stopsTotal, 0) > 0
        ? (kpis.reduce((sum, kpi) => sum + kpi.stopsCompleted, 0) /
            kpis.reduce((sum, kpi) => sum + kpi.stopsTotal, 0)) * 100
        : 0,
    };

    return NextResponse.json({
      kpis,
      stats,
      count: kpis.length,
    });
  } catch (error) {
    console.error("Error fetching KPIs:", error);
    return NextResponse.json(
      { message: "An error occurred while fetching KPIs" },
      { status: 500 }
    );
  }
}

