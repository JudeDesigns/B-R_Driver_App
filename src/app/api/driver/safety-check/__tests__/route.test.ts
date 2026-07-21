/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    route: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    routeCloseoutAssignment: {
      findUnique: jest.fn(),
    },
    routeCloseoutCheck: {
      findFirst: jest.fn(),
    },
    safetyCheck: {
      findFirst: jest.fn(),
    },
    stop: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/timezone", () => ({
  toPSTStartOfDay: jest.fn((d: Date) => d),
  getPSTDate: jest.fn(() => new Date()),
}));

jest.mock("@/lib/socket", () => ({
  emitStopStatusUpdate: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  route: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock };
  routeCloseoutAssignment: { findUnique: jest.Mock };
  routeCloseoutCheck: { findFirst: jest.Mock };
  safetyCheck: { findFirst: jest.Mock };
  stop: { findMany: jest.Mock; findFirst: jest.Mock };
  $transaction: jest.Mock;
};

const mockedVerifyToken = verifyToken as jest.Mock;

const ROUTE_ID = "route-1";
const DRIVER_ID = "driver-1";

function makeRequest(body: any) {
  return new NextRequest("http://localhost/api/driver/safety-check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  });
}

function setupBaseAssignedDriverMocks() {
  mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
  mockedPrisma.route.findUnique.mockResolvedValue({
    id: ROUTE_ID,
    status: "PENDING",
    stops: [{ driverNameFromUpload: "jdoe" }],
  });
  mockedPrisma.user.findUnique.mockResolvedValue({
    username: "jdoe",
    fullName: "John Doe",
  });
}

function setupPassingTransaction() {
  mockedPrisma.safetyCheck.findFirst.mockResolvedValue(null);
  const createdSafetyCheck = { id: "sc1", type: "END_OF_DAY" };
  mockedPrisma.$transaction.mockImplementation(async (cb: any) => {
    const tx = {
      route: { findUnique: jest.fn().mockResolvedValue({ id: ROUTE_ID, date: new Date() }) },
      stop: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      safetyCheck: { create: jest.fn().mockResolvedValue(createdSafetyCheck) },
      dailyKPI: {
        upsert: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    return cb(tx);
  });
  mockedPrisma.stop.findMany.mockResolvedValue([]);
  mockedPrisma.route.update.mockResolvedValue({});
  return createdSafetyCheck;
}

describe("POST /api/driver/safety-check - route closeout enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 403 with requiresRouteCheckin when assignment exists but no RouteCloseoutCheck yet (END_OF_DAY)", async () => {
    setupBaseAssignedDriverMocks();
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "WAREHOUSE" });
    mockedPrisma.routeCloseoutCheck.findFirst.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ routeId: ROUTE_ID, type: "END_OF_DAY", details: {} })
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual(
      expect.objectContaining({ requiresRouteCheckin: true, routeId: ROUTE_ID })
    );
    // Must not have proceeded to check for existing safety check
    expect(mockedPrisma.safetyCheck.findFirst).not.toHaveBeenCalled();
  });

  it("returns 403 with requiresRouteCheckin when latest check has pendingPickup: true (END_OF_DAY)", async () => {
    setupBaseAssignedDriverMocks();
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "JETRO" });
    mockedPrisma.routeCloseoutCheck.findFirst.mockResolvedValue({ pendingPickup: true });

    const response = await POST(
      makeRequest({ routeId: ROUTE_ID, type: "END_OF_DAY", details: {} })
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual(
      expect.objectContaining({ requiresRouteCheckin: true, routeId: ROUTE_ID })
    );
  });

  it("proceeds normally (200) when latest check has pendingPickup: false (END_OF_DAY)", async () => {
    setupBaseAssignedDriverMocks();
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "WAREHOUSE" });
    mockedPrisma.routeCloseoutCheck.findFirst.mockResolvedValue({ pendingPickup: false });
    setupPassingTransaction();

    const response = await POST(
      makeRequest({ routeId: ROUTE_ID, type: "END_OF_DAY", details: {} })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe("Safety check submitted successfully");
  });

  it("proceeds normally (200) when there is NO RouteCloseoutAssignment at all (END_OF_DAY)", async () => {
    setupBaseAssignedDriverMocks();
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue(null);
    setupPassingTransaction();

    const response = await POST(
      makeRequest({ routeId: ROUTE_ID, type: "END_OF_DAY", details: {} })
    );

    expect(response.status).toBe(200);
    // Should not have even checked for a RouteCloseoutCheck since there was no assignment
    expect(mockedPrisma.routeCloseoutCheck.findFirst).not.toHaveBeenCalled();
  });

  it("does not evaluate closeout check at all for START_OF_DAY requests", async () => {
    setupBaseAssignedDriverMocks();
    setupPassingTransaction();

    const response = await POST(
      makeRequest({ routeId: ROUTE_ID, type: "START_OF_DAY", details: {} })
    );

    expect(mockedPrisma.routeCloseoutAssignment.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.routeCloseoutCheck.findFirst).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
