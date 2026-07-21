/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    routeCloseoutAssignment: {
      findUnique: jest.fn(),
    },
    routeCloseoutCheck: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
  routeCloseoutAssignment: { findUnique: jest.Mock };
  routeCloseoutCheck: { findFirst: jest.Mock; create: jest.Mock };
};

const mockedVerifyToken = verifyToken as jest.Mock;

const ROUTE_ID = "route-1";
const DRIVER_ID = "driver-1";

function makeGetRequest(opts: { withAuth?: boolean; routeId?: string | null } = {}) {
  const { withAuth = true, routeId = ROUTE_ID } = opts;
  const headers: Record<string, string> = {};
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  const url = new URL("http://localhost/api/driver/route-checkin");
  if (routeId !== null) url.searchParams.set("routeId", routeId);
  return new NextRequest(url, { method: "GET", headers });
}

function makePostRequest(body: any, opts: { withAuth?: boolean } = {}) {
  const { withAuth = true } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest("http://localhost/api/driver/route-checkin", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("GET /api/driver/route-checkin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header", async () => {
    const response = await GET(makeGetRequest({ withAuth: false }));
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it("returns 401 when role !== DRIVER", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "ADMIN" });
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(401);
  });

  it("returns 400 when routeId query param is missing", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    const response = await GET(makeGetRequest({ routeId: null }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when driver is not found", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    const response = await GET(makeGetRequest());
    expect(response.status).toBe(404);
  });

  it("returns required:false when no assignment exists", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.user.findUnique.mockResolvedValue({ username: "jdoe", fullName: "John Doe" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue(null);

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data).toEqual({ required: false });
  });

  it("returns required:true, resolved:false, latestCheck:null when assignment exists but no check yet", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.user.findUnique.mockResolvedValue({ username: "jdoe", fullName: "John Doe" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "WAREHOUSE" });
    mockedPrisma.routeCloseoutCheck.findFirst.mockResolvedValue(null);

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data).toEqual({
      required: true,
      type: "WAREHOUSE",
      latestCheck: null,
      resolved: false,
    });
  });

  it("returns required:true, resolved:false when latestCheck.pendingPickup === true", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.user.findUnique.mockResolvedValue({ username: "jdoe", fullName: "John Doe" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "JETRO" });
    const latestCheck = { id: "c1", pendingPickup: true };
    mockedPrisma.routeCloseoutCheck.findFirst.mockResolvedValue(latestCheck);

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data.required).toBe(true);
    expect(data.resolved).toBe(false);
    expect(data.latestCheck).toEqual(latestCheck);
    expect(data.type).toBe("JETRO");
  });

  it("returns required:true, resolved:true when latestCheck.pendingPickup === false", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.user.findUnique.mockResolvedValue({ username: "jdoe", fullName: "John Doe" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "WAREHOUSE" });
    const latestCheck = { id: "c1", pendingPickup: false };
    mockedPrisma.routeCloseoutCheck.findFirst.mockResolvedValue(latestCheck);

    const response = await GET(makeGetRequest());
    const data = await response.json();
    expect(data.required).toBe(true);
    expect(data.resolved).toBe(true);
  });
});

describe("POST /api/driver/route-checkin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header", async () => {
    const response = await POST(
      makePostRequest(
        { routeId: ROUTE_ID, contactedPerson: "Office", pendingPickup: true, photoUrl: "url" },
        { withAuth: false }
      )
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await POST(
      makePostRequest({ routeId: ROUTE_ID, contactedPerson: "Office", pendingPickup: true, photoUrl: "url" })
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when role !== DRIVER", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "ADMIN" });
    const response = await POST(
      makePostRequest({ routeId: ROUTE_ID, contactedPerson: "Office", pendingPickup: true, photoUrl: "url" })
    );
    expect(response.status).toBe(401);
  });

  it.each([
    ["routeId", { contactedPerson: "Office", pendingPickup: true, photoUrl: "url" }],
    ["contactedPerson", { routeId: ROUTE_ID, pendingPickup: true, photoUrl: "url" }],
    ["photoUrl", { routeId: ROUTE_ID, contactedPerson: "Office", pendingPickup: true }],
  ])("returns 400 when %s is missing", async (_field, body) => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    const response = await POST(makePostRequest(body));
    expect(response.status).toBe(400);
  });

  it("returns 400 when pendingPickup is missing", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    const response = await POST(
      makePostRequest({ routeId: ROUTE_ID, contactedPerson: "Office", photoUrl: "url" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when pendingPickup is a string instead of boolean", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    const response = await POST(
      makePostRequest({
        routeId: ROUTE_ID,
        contactedPerson: "Office",
        pendingPickup: "true",
        photoUrl: "url",
      })
    );
    expect(response.status).toBe(400);
  });

  it.each([undefined, "", "   "])(
    "returns 400 when pendingPickup === false and note is %p",
    async (note) => {
      mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
      const response = await POST(
        makePostRequest({
          routeId: ROUTE_ID,
          contactedPerson: "Office",
          pendingPickup: false,
          photoUrl: "url",
          note,
        })
      );
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toMatch(/note is required/);
    }
  );

  it("returns 200 when pendingPickup === true and note is omitted entirely", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "WAREHOUSE" });
    mockedPrisma.routeCloseoutCheck.create.mockResolvedValue({ id: "c1" });

    const response = await POST(
      makePostRequest({
        routeId: ROUTE_ID,
        contactedPerson: "Office",
        pendingPickup: true,
        photoUrl: "url",
      })
    );
    expect(response.status).toBe(200);
  });

  it("returns 404 when no RouteCloseoutAssignment exists", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue(null);

    const response = await POST(
      makePostRequest({
        routeId: ROUTE_ID,
        contactedPerson: "Office",
        pendingPickup: true,
        photoUrl: "url",
      })
    );
    expect(response.status).toBe(404);
  });

  it("success: calls routeCloseoutCheck.create with correct shape and returns the created record", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockResolvedValue({ type: "JETRO" });
    const created = { id: "c1", routeId: ROUTE_ID, driverId: DRIVER_ID, type: "JETRO" };
    mockedPrisma.routeCloseoutCheck.create.mockResolvedValue(created);

    const response = await POST(
      makePostRequest({
        routeId: ROUTE_ID,
        contactedPerson: "Barak",
        pendingPickup: false,
        photoUrl: "https://example.com/photo.jpg",
        note: "3 pallets left at dock 2",
      })
    );

    expect(mockedPrisma.routeCloseoutCheck.create).toHaveBeenCalledWith({
      data: {
        routeId: ROUTE_ID,
        driverId: DRIVER_ID,
        type: "JETRO",
        contactedPerson: "Barak",
        pendingPickup: false,
        note: "3 pallets left at dock 2",
        photoUrl: "https://example.com/photo.jpg",
      },
    });
    const data = await response.json();
    expect(data).toEqual(created);
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.routeCloseoutAssignment.findUnique.mockRejectedValue(new Error("db error"));

    const response = await POST(
      makePostRequest({
        routeId: ROUTE_ID,
        contactedPerson: "Office",
        pendingPickup: true,
        photoUrl: "url",
      })
    );
    expect(response.status).toBe(500);
  });
});
