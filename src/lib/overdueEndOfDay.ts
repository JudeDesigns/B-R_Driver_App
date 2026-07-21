import type { PrismaClient } from "@prisma/client";

// Shared detection logic for "overdue End-of-Day" drivers: a driver whose
// last stop on a route was completed more than 3 hours ago, has no other
// incomplete stops remaining on that route, and has not yet submitted an
// END_OF_DAY safety check for that route.
//
// Used by both the admin dashboard GET endpoint
// (/api/admin/safety-checks/overdue-end-of-day) and the internal background
// poller (/api/internal/check-overdue-end-of-day) so the logic isn't
// duplicated.
export async function findOverdueEndOfDayDrivers(prisma: PrismaClient) {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

  // Candidate completed stops whose completion time is at least 3 hours old.
  const completedStops = await prisma.stop.findMany({
    where: {
      status: "COMPLETED",
      isDeleted: false,
      completionTime: {
        lte: threeHoursAgo,
      },
    },
    select: {
      routeId: true,
      driverNameFromUpload: true,
      completionTime: true,
      route: {
        select: {
          id: true,
          routeNumber: true,
          date: true,
        },
      },
    },
  });

  // Group by routeId + driverNameFromUpload, tracking the max completionTime
  // per group as the "last stop completion" for that driver on that route.
  type Group = {
    routeId: string;
    driverNameFromUpload: string;
    routeNumber: string | null;
    lastStopCompletionTime: Date;
  };
  const groups = new Map<string, Group>();

  completedStops.forEach((stop) => {
    if (!stop.driverNameFromUpload || !stop.completionTime) return;

    const key = `${stop.routeId}::${stop.driverNameFromUpload}`;
    const existing = groups.get(key);

    if (!existing || stop.completionTime > existing.lastStopCompletionTime) {
      groups.set(key, {
        routeId: stop.routeId,
        driverNameFromUpload: stop.driverNameFromUpload,
        routeNumber: stop.route?.routeNumber ?? null,
        lastStopCompletionTime: stop.completionTime,
      });
    }
  });

  if (groups.size === 0) {
    return [];
  }

  const routeIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.routeId)));

  // For each route, find stops that are not yet COMPLETED/CANCELLED so we can
  // skip driver+route groups that haven't actually finished their route yet.
  const incompleteStops = await prisma.stop.findMany({
    where: {
      routeId: { in: routeIds },
      isDeleted: false,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    select: {
      routeId: true,
      driverNameFromUpload: true,
    },
  });

  const incompleteKeys = new Set(
    incompleteStops
      .filter((s) => !!s.driverNameFromUpload)
      .map((s) => `${s.routeId}::${s.driverNameFromUpload}`)
  );

  const remainingGroups = Array.from(groups.values()).filter(
    (g) => !incompleteKeys.has(`${g.routeId}::${g.driverNameFromUpload}`)
  );

  if (remainingGroups.length === 0) {
    return [];
  }

  // Resolve each driverNameFromUpload to an actual User (matching username or
  // fullName, case-insensitively).
  const allUsers = await prisma.user.findMany({
    where: {
      role: "DRIVER",
      isDeleted: false,
    },
    select: {
      id: true,
      username: true,
      fullName: true,
    },
  });

  const userLookup = new Map<string, { id: string; username: string; fullName: string | null }>();
  allUsers.forEach((u) => {
    userLookup.set(u.username.toLowerCase(), u);
    if (u.fullName) userLookup.set(u.fullName.toLowerCase(), u);
  });

  const resolvedGroups = remainingGroups
    .map((g) => {
      const user = userLookup.get(g.driverNameFromUpload.trim().toLowerCase());
      return user ? { ...g, driverId: user.id, driverName: user.fullName || user.username } : null;
    })
    .filter((g): g is Group & { driverId: string; driverName: string } => !!g);

  if (resolvedGroups.length === 0) {
    return [];
  }

  // Batch-fetch existing END_OF_DAY safety checks for these route/driver
  // combinations so we can exclude drivers who have already submitted one.
  const existingChecks = await prisma.safetyCheck.findMany({
    where: {
      type: "END_OF_DAY",
      isDeleted: false,
      routeId: { in: resolvedGroups.map((g) => g.routeId) },
      driverId: { in: resolvedGroups.map((g) => g.driverId) },
    },
    select: {
      routeId: true,
      driverId: true,
    },
  });

  const completedKeys = new Set(
    existingChecks.map((c) => `${c.routeId}::${c.driverId}`)
  );

  const overdue = resolvedGroups
    .filter((g) => !completedKeys.has(`${g.routeId}::${g.driverId}`))
    .map((g) => ({
      routeId: g.routeId,
      routeNumber: g.routeNumber,
      driverId: g.driverId,
      driverName: g.driverName,
      lastStopCompletionTime: g.lastStopCompletionTime,
      hoursOverdue:
        Math.round(
          ((Date.now() - g.lastStopCompletionTime.getTime()) / (60 * 60 * 1000)) * 10
        ) / 10,
    }));

  return overdue;
}
