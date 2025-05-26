import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import apiCache, { TTL } from "@/lib/cache";

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

    // Generate a cache key based on the date
    const todayDateString = today.toISOString().split("T")[0];
    const cacheKeyPrefix = `dashboard:${todayDateString}:${userId}`;

    // Get today's routes with caching
    const todaysRoutes = await apiCache.getOrSet(
      `${cacheKeyPrefix}:todaysRoutes`,
      async () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("Cache miss for today's routes, fetching from database");
        }
        return prisma.route.findMany({
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
      },
      TTL.SHORT // Cache for 30 seconds
    );

    // Get route statistics with caching
    const routeStats = await apiCache.getOrSet(
      `${cacheKeyPrefix}:routeStats`,
      async () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("Cache miss for route stats, fetching from database");
        }
        return prisma.$transaction([
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
      },
      TTL.SHORT // Cache for 30 seconds
    );

    // Get stop statistics with caching
    const stopStats = await apiCache.getOrSet(
      `${cacheKeyPrefix}:stopStats`,
      async () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("Cache miss for stop stats, fetching from database");
        }
        return prisma.$transaction([
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
      },
      TTL.SHORT // Cache for 30 seconds
    );

    // Get active drivers with caching
    const { activeDrivers, uniqueDrivers } = await apiCache.getOrSet(
      `${cacheKeyPrefix}:activeDrivers`,
      async () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("Cache miss for active drivers, fetching from database");
        }

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

        // Then count unique routeIds
        const uniqueRouteIds = new Set(
          todaysSafetyChecks.map((check) => check.routeId)
        );
        const activeDrivers = uniqueRouteIds.size;

        // Get unique drivers
        const uniqueDrivers = Array.from(
          new Map(
            todaysSafetyChecks
              .filter((check) => check.route && check.route.driver) // Filter out any null values
              .map((check) => [check.route.driverId, check.route.driver])
          ).values()
        );

        return { activeDrivers, uniqueDrivers };
      },
      TTL.SHORT // Cache for 30 seconds
    );

    // Get delivery stats with caching
    const { ongoingDeliveries, completedStops, activeRoutes } =
      await apiCache.getOrSet(
        `${cacheKeyPrefix}:deliveryStats`,
        async () => {
          if (process.env.NODE_ENV !== "production") {
            console.log(
              "Cache miss for delivery stats, fetching from database"
            );
          }

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

          return { ongoingDeliveries, completedStops, activeRoutes };
        },
        TTL.SHORT // Cache for 30 seconds
      );

    // Get email statistics with caching
    const emailStats = await apiCache.getOrSet(
      `${cacheKeyPrefix}:emailStats`,
      async () => {
        if (process.env.NODE_ENV !== "production") {
          console.log("Cache miss for email stats, fetching from database");
        }

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

        const stats = {
          sent: 0,
          pending: 0,
          failed: 0,
        };

        emailCounts.forEach((count) => {
          if (count.status === "SENT") {
            stats.sent = count._count.status;
          } else if (count.status === "PENDING") {
            stats.pending = count._count.status;
          } else if (count.status === "FAILED") {
            stats.failed = count._count.status;
          }
        });

        return stats;
      },
      TTL.SHORT // Cache for 30 seconds
    );

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
