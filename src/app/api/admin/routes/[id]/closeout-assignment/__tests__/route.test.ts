/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET, PATCH } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    routeCloseoutAssignment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  routeCloseoutAssignment: {
    findMany: jest.Mock;
    deleteMany: jest.Mock;
    upsert: jest.Mock;
  };
};

const mockedVerifyToken = verifyToken as jest.Mock;

const ROUTE_ID = "route-1";
const DRIVER_ID = "driver-1";

function makeParams(id: string = ROUTE_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(opts: { withAuth?: boolean } = {}) {
  const { withAuth = true } = opts;
  const headers: Record<string, string> = {};
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest(`http://localhost/api/admin/routes/${ROUTE_ID}/closeout-assignment`, {
    method: "GET",
    headers,
  });
}

function makePatchRequest(body: any, opts: { withAuth?: boolean } = {}) {
  const { withAuth = true } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest(`http://localhost/api/admin/routes/${ROUTE_ID}/closeout-assignment`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/routes/[id]/closeout-assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await GET(makeGetRequest({ withAuth: false }), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await GET(makeGetRequest(), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns 401 when role is DRIVER", async () => {
    mockedVerifyToken.mockReturnValue({ id: "u1", role: "DRIVER" });
    const response = await GET(makeGetRequest(), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns { assignments } from routeCloseoutAssignment.findMany", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    const assignments = [{ id: "a1", routeId: ROUTE_ID, driverId: DRIVER_ID, type: "WAREHOUSE" }];
    mockedPrisma.routeCloseoutAssignment.findMany.mockResolvedValue(assignments);

    const response = await GET(makeGetRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ assignments });
    expect(mockedPrisma.routeCloseoutAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { routeId: ROUTE_ID } })
    );
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "SUPER_ADMIN" });
    mockedPrisma.routeCloseoutAssignment.findMany.mockRejectedValue(new Error("db down"));

    const response = await GET(makeGetRequest(), makeParams());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.message).toContain("db down");
  });
});

describe("PATCH /api/admin/routes/[id]/closeout-assignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: "WAREHOUSE" }, { withAuth: false }),
      makeParams()
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: "WAREHOUSE" }),
      makeParams()
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when role is DRIVER", async () => {
    mockedVerifyToken.mockReturnValue({ id: "u1", role: "DRIVER" });
    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: "WAREHOUSE" }),
      makeParams()
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 when driverId is missing", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    const response = await PATCH(makePatchRequest({ type: "WAREHOUSE" }), makeParams());
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/driverId/);
  });

  it("returns 400 when type is not WAREHOUSE/JETRO/null", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: "FOO" }),
      makeParams()
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/type must be one of/);
  });

  it("returns 404 when driver is not found", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: "WAREHOUSE" }),
      makeParams()
    );
    expect(response.status).toBe(404);
  });

  it("with type: null calls deleteMany with routeId/driverId and returns { removed: true }", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue({ id: DRIVER_ID });
    mockedPrisma.routeCloseoutAssignment.deleteMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: null }),
      makeParams()
    );

    expect(mockedPrisma.routeCloseoutAssignment.deleteMany).toHaveBeenCalledWith({
      where: { routeId: ROUTE_ID, driverId: DRIVER_ID },
    });
    const data = await response.json();
    expect(data).toEqual({ removed: true });
  });

  it.each(["WAREHOUSE", "JETRO"])(
    "with type: %s calls upsert with correct where/create/update shape and returns the assignment",
    async (type) => {
      mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
      mockedPrisma.user.findUnique.mockResolvedValue({ id: DRIVER_ID });
      const assignment = { id: "a1", routeId: ROUTE_ID, driverId: DRIVER_ID, type };
      mockedPrisma.routeCloseoutAssignment.upsert.mockResolvedValue(assignment);

      const response = await PATCH(
        makePatchRequest({ driverId: DRIVER_ID, type }),
        makeParams()
      );

      expect(mockedPrisma.routeCloseoutAssignment.upsert).toHaveBeenCalledWith({
        where: { routeId_driverId: { routeId: ROUTE_ID, driverId: DRIVER_ID } },
        create: { routeId: ROUTE_ID, driverId: DRIVER_ID, type, assignedBy: "admin-1" },
        update: { type, assignedBy: "admin-1" },
      });
      const data = await response.json();
      expect(data).toEqual(assignment);
    }
  );

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.user.findUnique.mockRejectedValue(new Error("boom"));

    const response = await PATCH(
      makePatchRequest({ driverId: DRIVER_ID, type: "WAREHOUSE" }),
      makeParams()
    );
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.message).toContain("boom");
  });
});
