/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    systemDocument: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    documentAcknowledgment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  systemDocument: { findMany: jest.Mock; findUnique: jest.Mock };
  documentAcknowledgment: { findFirst: jest.Mock; create: jest.Mock };
};

const mockedVerifyToken = verifyToken as jest.Mock;

const DRIVER_ID = "driver-1";
const DOC_ID = "doc-1";
const ROUTE_ID = "route-1";

function makeGetRequest(opts: { withAuth?: boolean; routeId?: string | null } = {}) {
  const { withAuth = true, routeId = ROUTE_ID } = opts;
  const headers: Record<string, string> = {};
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  const url = new URL("http://localhost/api/driver/system-documents/acknowledge");
  if (routeId !== null) url.searchParams.set("routeId", routeId);
  return new NextRequest(url, { method: "GET", headers });
}

function makePostRequest(body: any, opts: { withAuth?: boolean } = {}) {
  const { withAuth = true } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest("http://localhost/api/driver/system-documents/acknowledge", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("GET /api/driver/system-documents/acknowledge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header is present", async () => {
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

  it("returns documents with requiresSignature field included", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        title: "Safety Policy",
        version: 1,
        requiresSignature: true,
        acknowledgments: [],
      },
    ]);

    const response = await GET(makeGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].requiresSignature).toBe(true);
    expect(data.documents[0]).not.toHaveProperty("acknowledgments");
  });

  it("excludes a document from the unacknowledged list when a valid ack matches the CURRENT documentVersion", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        title: "Safety Policy",
        version: 2,
        requiresSignature: false,
        acknowledgments: [
          { id: "ack-1", documentVersion: 2, isValid: true },
        ],
      },
    ]);

    const response = await GET(makeGetRequest());
    const data = await response.json();

    expect(data.documents).toHaveLength(0);
    expect(data.unacknowledgedCount).toBe(0);
  });

  it("includes a document when the driver's existing ack is for an OLDER documentVersion than current (needs re-sign after version bump)", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        title: "Safety Policy",
        version: 3,
        requiresSignature: true,
        acknowledgments: [
          { id: "ack-1", documentVersion: 2, isValid: true }, // older version
        ],
      },
    ]);

    const response = await GET(makeGetRequest());
    const data = await response.json();

    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].id).toBe(DOC_ID);
    expect(data.unacknowledgedCount).toBe(1);
  });

  it("includes a document when the existing ack has isValid: false (reset by admin) even if documentVersion matches", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    // Note: the route's prisma findMany where clause filters acknowledgments
    // to isValid: true already, but this test simulates the filter logic
    // directly to ensure the doc is treated as unsatisfied when there is no
    // acknowledgment with a matching version (invalidated rows won't be
    // present in the pre-filtered `acknowledgments` array).
    mockedPrisma.systemDocument.findMany.mockResolvedValue([
      {
        id: DOC_ID,
        title: "Safety Policy",
        version: 2,
        requiresSignature: false,
        acknowledgments: [], // invalidated row excluded by the isValid:true where-filter
      },
    ]);

    const response = await GET(makeGetRequest());
    const data = await response.json();

    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].id).toBe(DOC_ID);

    // Confirm the query itself filters on isValid: true, driverId - this is
    // what causes invalidated acks to be excluded from consideration.
    expect(mockedPrisma.systemDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          acknowledgments: expect.objectContaining({
            where: { driverId: DRIVER_ID, isValid: true },
          }),
        }),
      })
    );
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findMany.mockRejectedValue(new Error("db down"));

    const response = await GET(makeGetRequest());
    expect(response.status).toBe(500);
  });
});

describe("POST /api/driver/system-documents/acknowledge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await POST(makePostRequest({ documentId: DOC_ID }, { withAuth: false }));
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await POST(makePostRequest({ documentId: DOC_ID }));
    expect(response.status).toBe(401);
  });

  it("returns 401 when role !== DRIVER", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "ADMIN" });
    const response = await POST(makePostRequest({ documentId: DOC_ID }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when documentId is missing", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    const response = await POST(makePostRequest({}));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the document doesn't exist or is inactive/deleted", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue(null);

    const response = await POST(makePostRequest({ documentId: DOC_ID }));
    expect(response.status).toBe(404);
  });

  it("returns 400 when the target document has requiresSignature: true (directs to /sign instead)", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
      requiresSignature: true,
    });

    const response = await POST(makePostRequest({ documentId: DOC_ID }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/requires a signature/);
    expect(mockedPrisma.documentAcknowledgment.create).not.toHaveBeenCalled();
  });

  it("is idempotent: returns existing acknowledgment without creating a duplicate if already acknowledged at current version", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 2,
      requiresSignature: false,
    });
    const existingAck = { id: "ack-1", documentId: DOC_ID, driverId: DRIVER_ID, documentVersion: 2 };
    mockedPrisma.documentAcknowledgment.findFirst.mockResolvedValue(existingAck);

    const response = await POST(makePostRequest({ documentId: DOC_ID, routeId: ROUTE_ID }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toMatch(/already acknowledged/);
    expect(data.acknowledgment).toEqual(existingAck);
    expect(mockedPrisma.documentAcknowledgment.create).not.toHaveBeenCalled();
  });

  it("creates a new acknowledgment correctly for requiresSignature=false docs", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
      requiresSignature: false,
    });
    mockedPrisma.documentAcknowledgment.findFirst.mockResolvedValue(null);

    const created = { id: "ack-new", documentId: DOC_ID, driverId: DRIVER_ID, documentVersion: 1 };
    mockedPrisma.documentAcknowledgment.create.mockResolvedValue(created);

    const response = await POST(makePostRequest({ documentId: DOC_ID, routeId: ROUTE_ID }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.documentAcknowledgment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: DOC_ID,
          driverId: DRIVER_ID,
          routeId: ROUTE_ID,
          documentVersion: 1,
        }),
      })
    );
    expect(data.acknowledgment).toEqual(created);
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockRejectedValue(new Error("db down"));

    const response = await POST(makePostRequest({ documentId: DOC_ID }));
    expect(response.status).toBe(500);
  });
});
