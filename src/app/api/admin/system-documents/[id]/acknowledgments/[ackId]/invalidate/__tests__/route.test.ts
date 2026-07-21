/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    documentAcknowledgment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  documentAcknowledgment: { findUnique: jest.Mock; update: jest.Mock };
};

const mockedVerifyToken = verifyToken as jest.Mock;

const DOC_ID = "doc-1";
const ACK_ID = "ack-1";

function makeParams(id: string = DOC_ID, ackId: string = ACK_ID) {
  return { params: Promise.resolve({ id, ackId }) };
}

function makeRequest(opts: { withAuth?: boolean } = {}) {
  const { withAuth = true } = opts;
  const headers: Record<string, string> = {};
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest(
    `http://localhost/api/admin/system-documents/${DOC_ID}/acknowledgments/${ACK_ID}/invalidate`,
    { method: "POST", headers }
  );
}

describe("POST /api/admin/system-documents/[id]/acknowledgments/[ackId]/invalidate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await POST(makeRequest({ withAuth: false }), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns 401 when role is DRIVER (non-admin)", async () => {
    mockedVerifyToken.mockReturnValue({ id: "u1", role: "DRIVER" });
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns 404 when the acknowledgment doesn't exist at all", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.documentAcknowledgment.findUnique.mockResolvedValue(null);

    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
    expect(mockedPrisma.documentAcknowledgment.update).not.toHaveBeenCalled();
  });

  it("returns 404 when ackId exists but belongs to a different documentId (mismatch protection)", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.documentAcknowledgment.findUnique.mockResolvedValue({
      id: ACK_ID,
      documentId: "some-other-doc",
      driverId: "driver-1",
    });

    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
    expect(mockedPrisma.documentAcknowledgment.update).not.toHaveBeenCalled();
  });

  it("successfully invalidates the specific acknowledgment: sets isValid false, invalidatedAt, invalidatedBy; does not delete the row", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.documentAcknowledgment.findUnique.mockResolvedValue({
      id: ACK_ID,
      documentId: DOC_ID,
      driverId: "driver-1",
      isValid: true,
    });

    const updatedAck = {
      id: ACK_ID,
      documentId: DOC_ID,
      driverId: "driver-1",
      isValid: false,
      invalidatedAt: new Date(),
      invalidatedBy: "admin-1",
    };
    mockedPrisma.documentAcknowledgment.update.mockResolvedValue(updatedAck);

    const response = await POST(makeRequest(), makeParams());

    expect(response.status).toBe(200);
    expect(mockedPrisma.documentAcknowledgment.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockedPrisma.documentAcknowledgment.update.mock.calls[0][0];

    // Verify the prisma update `where` clause only targets this specific ackId
    // (i.e. other drivers'/other acknowledgments' rows are unaffected).
    expect(updateArgs.where).toEqual({ id: ACK_ID });
    expect(updateArgs.data.isValid).toBe(false);
    expect(updateArgs.data.invalidatedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.invalidatedBy).toBe("admin-1");

    const data = await response.json();
    expect(data.acknowledgment).toEqual({
      ...updatedAck,
      invalidatedAt: updatedAck.invalidatedAt.toISOString(),
    });
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.documentAcknowledgment.findUnique.mockRejectedValue(new Error("db down"));

    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(500);
  });
});
