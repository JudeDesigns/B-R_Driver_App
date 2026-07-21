import { findOverdueEndOfDayDrivers } from "../overdueEndOfDay";

describe("findOverdueEndOfDayDrivers", () => {
  function makePrisma(overrides: Partial<any> = {}) {
    return {
      stop: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      safetyCheck: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ...overrides,
    };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns [] when the completed-stops query resolves []", async () => {
    const prisma = makePrisma();
    prisma.stop.findMany.mockResolvedValueOnce([]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);

    expect(result).toEqual([]);
    // Should short-circuit before querying incomplete stops / users / safety checks
    expect(prisma.stop.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("groups multiple completed stops for the same routeId+driverNameFromUpload, keeping the max completionTime", async () => {
    const older = new Date("2026-07-20T10:00:00.000Z");
    const newer = new Date("2026-07-20T12:00:00.000Z");

    const prisma = makePrisma();
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime: older,
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime: newer,
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([]); // incomplete stops

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "jsmith", fullName: "John Smith" },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);

    expect(result).toHaveLength(1);
    expect(result[0].lastStopCompletionTime).toEqual(newer);
    expect(result[0].driverId).toBe("user-1");
  });

  it("excludes a route+driver group when incomplete stops exist for that route+driver", async () => {
    const prisma = makePrisma();
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime: new Date("2026-07-20T10:00:00.000Z"),
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([
        { routeId: "route-1", driverNameFromUpload: "John Smith" },
      ]);

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "jsmith", fullName: "John Smith" },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);

    expect(result).toEqual([]);
  });

  it("excludes a group when driverNameFromUpload doesn't match any user's username or fullName (case check)", async () => {
    const prisma = makePrisma();
    // "JOHN SMITH" should NOT match username "john.smith" (different string, not equal ignoring case)
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "JOHN SMITH",
          completionTime: new Date("2026-07-20T10:00:00.000Z"),
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([]);

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "john.smith", fullName: null },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);
    expect(result).toEqual([]);
  });

  it("matches driverNameFromUpload against fullName case-insensitively", async () => {
    const prisma = makePrisma();
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime: new Date("2026-07-20T10:00:00.000Z"),
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([]);

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "jsmith99", fullName: "john smith" },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);
    expect(result).toHaveLength(1);
    expect(result[0].driverId).toBe("user-1");
  });

  it("excludes a group whose route+driver already has an END_OF_DAY SafetyCheck", async () => {
    const prisma = makePrisma();
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime: new Date("2026-07-20T10:00:00.000Z"),
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([]);

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "jsmith", fullName: "John Smith" },
    ]);

    prisma.safetyCheck.findMany.mockResolvedValue([
      { routeId: "route-1", driverId: "user-1" },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);
    expect(result).toEqual([]);
  });

  it("correctly computes hoursOverdue for a fixed completion time 5 hours before now", async () => {
    const now = new Date("2026-07-21T15:00:00.000Z");
    jest.useFakeTimers().setSystemTime(now);

    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    const prisma = makePrisma();
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime: fiveHoursAgo,
          route: { id: "route-1", routeNumber: "R1", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([]);

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "jsmith", fullName: "John Smith" },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);

    expect(result).toHaveLength(1);
    expect(result[0].hoursOverdue).toBeCloseTo(5, 1);
  });

  it("returns a fully resolved item with all expected fields when nothing excludes it", async () => {
    const completionTime = new Date("2026-07-20T10:00:00.000Z");
    const prisma = makePrisma();
    prisma.stop.findMany
      .mockResolvedValueOnce([
        {
          routeId: "route-1",
          driverNameFromUpload: "John Smith",
          completionTime,
          route: { id: "route-1", routeNumber: "R-42", date: new Date() },
        },
      ])
      .mockResolvedValueOnce([]);

    prisma.user.findMany.mockResolvedValue([
      { id: "user-1", username: "jsmith", fullName: "John Smith" },
    ]);

    const result = await findOverdueEndOfDayDrivers(prisma as any);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        routeId: "route-1",
        routeNumber: "R-42",
        driverId: "user-1",
        driverName: "John Smith",
        lastStopCompletionTime: completionTime,
      })
    );
    expect(typeof result[0].hoursOverdue).toBe("number");
  });
});
