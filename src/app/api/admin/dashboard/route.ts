import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
// Cache removed for cleaner codebase

// GET /api/admin/dashboard - Get dashboard data including today's routes
export async function GET(request: NextRequest) {
  try {
    // Simple token verification for now
    const authHeader = request.headers.get("authorization");
    const tokenFromCookie = request.cookies.get("auth-token")?.value;

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (tokenFromCookie) {
      token = tokenFromCookie;
    }

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Verify token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // Check if user has admin privileges
    if (!["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const userId = decoded.id;

    // Get today's date (start and end)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Date range:",
        today.toISOString(),
        "to",
        tomorrow.toISOString()
      );
    }

    // Get today's routes
    const todaysRoutes = await prisma.route.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
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
        createdAt: "desc",
      },
      take: 5, // Limit to 5 most recent routes
    });

    // Get route statistics
    const routeStats = await prisma.$transaction([
      // Total routes
      prisma.route.count({
        where: {
          isDeleted: false,
        },
      }),
      // Today's routes
      prisma.route.count({
        where: {
          isDeleted: false,
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),
      // Routes by status
      prisma.route.groupBy({
        by: ["status"],
        where: {
          isDeleted: false,
        },
        _count: {
          id: true,
        },
      }),
      // Today's routes by status
      prisma.route.groupBy({
        by: ["status"],
        where: {
          isDeleted: false,
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Get stop statistics
    const stopStats = await prisma.$transaction([
      // Total stops
      prisma.stop.count({
        where: {
          isDeleted: false,
        },
      }),
      // Today's stops
      prisma.stop.count({
        where: {
          isDeleted: false,
          route: {
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
      }),
      // Stops by status
      prisma.stop.groupBy({
        by: ["status"],
        where: {
          isDeleted: false,
        },
        _count: {
          id: true,
        },
      }),
      // Today's stops by status
      prisma.stop.groupBy({
        by: ["status"],
        where: {
          isDeleted: false,
          route: {
            date: {
              gte: today,
              lt: tomorrow,
            },
          },
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Get active drivers (those who have submitted safety checks today)
    const todaysSafetyChecks = await prisma.safetyCheck.findMany({
      where: {
        timestamp: {
          gte: today,
          lt: tomorrow,
        },
        type: "START_OF_DAY",
        isDeleted: false,
      },
      select: {
        driverId: true,
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        routeId: true,
        route: {
          select: {
            driverId: true,
            driver: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    // Get unique drivers from safety checks (using driverId from safety check, not route)
    const uniqueDriversMap = new Map();

    todaysSafetyChecks.forEach((check) => {
      // Prefer driver info from the safety check itself
      if (check.driver) {
        uniqueDriversMap.set(check.driverId, check.driver);
      }
      // Fallback to route driver info if safety check driver is null
      else if (check.route && check.route.driver) {
        uniqueDriversMap.set(check.route.driverId, check.route.driver);
      }
    });

    const uniqueDrivers = Array.from(uniqueDriversMap.values());
    const activeDrivers = uniqueDrivers.length;

    // Count ongoing deliveries (stops that are in progress)
    const ongoingDeliveries = await prisma.stop.count({
      where: {
        status: {
          in: ["ON_THE_WAY", "ARRIVED"],
        },
        route: {
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        isDeleted: false,
      },
    });

    // Count completed stops
    const completedStops = await prisma.stop.count({
      where: {
        status: "COMPLETED",
        route: {
          date: {
            gte: today,
            lt: tomorrow,
          },
        },
        isDeleted: false,
      },
    });

    // Count active routes
    const activeRoutes = await prisma.route.count({
      where: {
        status: "IN_PROGRESS",
        date: {
          gte: today,
          lt: tomorrow,
        },
        isDeleted: false,
      },
    });

    // Get email statistics
    const emailCounts = await prisma.customerEmail.groupBy({
      by: ["status"],
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        isDeleted: false,
      },
      _count: {
        status: true,
      },
    });

    const emailStats = {
      sent: 0,
      pending: 0,
      failed: 0,
    };

    emailCounts.forEach((count) => {
      if (count.status === "SENT") {
        emailStats.sent = count._count.status;
      } else if (count.status === "PENDING") {
        emailStats.pending = count._count.status;
      } else if (count.status === "FAILED") {
        emailStats.failed = count._count.status;
      }
    });

    // Only log in development mode
    if (process.env.NODE_ENV !== "production") {
      console.log("Data fetched successfully:");
      console.log("- Today's routes:", todaysRoutes.length);
      console.log("- Completed stops:", completedStops);
      console.log("- Active routes:", activeRoutes);
      console.log("- Active drivers:", activeDrivers);
      console.log("- Ongoing deliveries:", ongoingDeliveries);
    }

    // Format the status statistics
    const formatStatusStats = (stats: any[]) => {
      const result: Record<string, number> = {};
      stats.forEach((stat) => {
        result[stat.status] = stat._count.id;
      });
      return result;
    };

    const response = {
      todaysRoutes,
      stats: {
        completedStops,
        activeRoutes,
        activeDrivers,
        ongoingDeliveries,
      },
      routeStats: {
        total: routeStats[0],
        today: routeStats[1],
        byStatus: formatStatusStats(routeStats[2]),
        todayByStatus: formatStatusStats(routeStats[3]),
      },
      stopStats: {
        total: stopStats[0],
        today: stopStats[1],
        byStatus: formatStatusStats(stopStats[2]),
        todayByStatus: formatStatusStats(stopStats[3]),
      },
      activeDriverDetails: {
        count: activeDrivers,
        drivers: uniqueDrivers,
      },
      emailStats,
    };

    // Create response with cache control headers
    const response_obj = NextResponse.json(response);
    response_obj.headers.set("Cache-Control", "private, max-age=10"); // Private cache for 10 seconds

    return response_obj;
  } catch (error) {
    console.error("Dashboard error:", error);

    // Don't expose internal error details
    return NextResponse.json(
      { message: "An error occurred while fetching dashboard data" },
      { status: 500 }
    );
  }
}
