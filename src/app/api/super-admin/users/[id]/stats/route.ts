import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

// GET - Get aggregated stats for a single user (driver detail page)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Unwrap params
    const unwrappedParams = await Promise.resolve(params);
    const userId = unwrappedParams.id;

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

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        isDeleted: true,
        lastKnownLatitude: true,
        lastKnownLongitude: true,
        lastLocationUpdate: true,
        cachedClockInStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // Driver-to-route/stop assignment in this app is NOT done via Route.driverId
    // (which is deliberately left null on upload since a route can have multiple
    // drivers - see routeParser.ts). The real assignment lives on Stop.driverNameFromUpload
    // (a username string), falling back to Route.driverId only when a stop has no
    // driverNameFromUpload set. This matches the grouping logic used elsewhere
    // (e.g. admin route detail page, driver-maps page).
    const stopOwnershipFilter = {
      isDeleted: false,
      OR: [
        { driverNameFromUpload: { equals: user.username, mode: "insensitive" as const } },
        { driverNameFromUpload: null, route: { is: { driverId: userId } } },
      ],
    };

    const [
      ownedRoutes,
      totalStops,
      totalSafetyChecks,
      safetyCheckTypeCounts,
      totalValidAcknowledgments,
      requiredDocuments,
      currentVehicleAssignment,
      totalVehicleAssignments,
      lastSafetyCheck,
      lastDriverLocation,
      lastDailyKPI,
    ] = await Promise.all([
      // All non-deleted routes that have at least one stop owned by this driver
      prisma.route.findMany({
        where: {
          isDeleted: false,
          stops: { some: stopOwnershipFilter },
        },
        orderBy: { date: "desc" },
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
      prisma.stop.count({ where: stopOwnershipFilter }),
      prisma.safetyCheck.count({
        where: { driverId: userId, isDeleted: false },
      }),
      prisma.safetyCheck.groupBy({
        by: ["type"],
        where: { driverId: userId, isDeleted: false },
        _count: true,
      }),
      prisma.documentAcknowledgment.count({
        where: { driverId: userId, isValid: true },
      }),
      prisma.systemDocument.findMany({
        where: {
          isRequired: true,
          isActive: true,
          isDeleted: false,
        },
        include: {
          acknowledgments: {
            where: {
              driverId: userId,
              isValid: true,
            },
            orderBy: {
              acknowledgedAt: "desc",
            },
          },
        },
      }),
      prisma.vehicleAssignment.findFirst({
        where: { driverId: userId, isActive: true, isDeleted: false },
        orderBy: { assignedAt: "desc" },
        include: {
          vehicle: {
            select: {
              id: true,
              vehicleNumber: true,
            },
          },
        },
      }),
      prisma.vehicleAssignment.count({
        where: { driverId: userId, isDeleted: false },
      }),
      prisma.safetyCheck.findFirst({
        where: { driverId: userId, isDeleted: false },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      }),
      prisma.driverLocation.findFirst({
        where: { driverId: userId },
        orderBy: { timestamp: "desc" },
        select: { timestamp: true },
      }),
      prisma.dailyKPI.findFirst({
        where: { driverId: userId, isDeleted: false },
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

    // Derive route status breakdown, first/last date, and recent list from ownedRoutes
    const routeStatusCounts = ownedRoutes.reduce<Record<string, number>>(
      (acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      },
      {}
    );
    const firstRoute = ownedRoutes.length
      ? ownedRoutes[ownedRoutes.length - 1]
      : null;
    const lastRoute = ownedRoutes.length ? ownedRoutes[0] : null;
    const recentRoutes = ownedRoutes.slice(0, 10);
    const lastRouteForActivity = lastRoute;

    // Route status breakdown
    const routeStatusBreakdown = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    let totalRoutes = 0;
    for (const [status, count] of Object.entries(routeStatusCounts)) {
      if (status in routeStatusBreakdown) {
        routeStatusBreakdown[status as keyof typeof routeStatusBreakdown] =
          count;
      }
      totalRoutes += count;
    }

    // Safety check type breakdown
    const safetyCheckTypeBreakdown = {
      START_OF_DAY: 0,
      END_OF_DAY: 0,
    };
    for (const row of safetyCheckTypeCounts) {
      const count = row._count;
      safetyCheckTypeBreakdown[
        row.type as keyof typeof safetyCheckTypeBreakdown
      ] = count;
    }

    // Pending required documents (no valid acknowledgment for current version)
    const pendingDocuments = requiredDocuments
      .filter((doc) => {
        const currentValidAck = doc.acknowledgments.find(
          (ack) => ack.documentVersion === doc.version
        );
        return !currentValidAck;
      })
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
      }));

    // Compute last activity as max of the candidate dates
    const activityCandidates: (Date | null | undefined)[] = [
      lastRouteForActivity?.date,
      lastSafetyCheck?.timestamp,
      lastDriverLocation?.timestamp,
      lastDailyKPI?.date,
    ];
    const validActivityDates = activityCandidates.filter(
      (d): d is Date => !!d
    );
    const lastActivity =
      validActivityDates.length > 0
        ? new Date(
            Math.max(...validActivityDates.map((d) => new Date(d).getTime()))
          )
        : null;

    return NextResponse.json({
      user,
      routes: {
        total: totalRoutes,
        byStatus: routeStatusBreakdown,
        firstRouteDate: firstRoute?.date ?? null,
        lastRouteDate: lastRoute?.date ?? null,
        recent: recentRoutes.map((r) => ({
          id: r.id,
          routeNumber: r.routeNumber,
          date: r.date,
          status: r.status,
          stopsCount: r._count.stops,
        })),
      },
      stops: {
        total: totalStops,
      },
      safetyChecks: {
        total: totalSafetyChecks,
        byType: safetyCheckTypeBreakdown,
      },
      documents: {
        totalAcknowledged: totalValidAcknowledgments,
        pending: pendingDocuments,
        pendingCount: pendingDocuments.length,
      },
      vehicle: {
        current: currentVehicleAssignment
          ? {
              id: currentVehicleAssignment.id,
              assignedAt: currentVehicleAssignment.assignedAt,
              vehicleId: currentVehicleAssignment.vehicle.id,
              vehicleNumber: currentVehicleAssignment.vehicle.vehicleNumber,
            }
          : null,
        totalAssignments: totalVehicleAssignments,
      },
      lastActivity,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
