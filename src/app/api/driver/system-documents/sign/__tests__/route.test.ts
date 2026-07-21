/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { findSignaturePlacement } from "@/lib/pdfSignaturePlacement";
import { sendSignedDocumentEmail } from "@/lib/email";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    systemDocument: {
      findUnique: jest.fn(),
    },
    documentAcknowledgment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from("fake-pdf-bytes")),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

jest.mock("pdf-lib", () => ({
  PDFDocument: {
    load: jest.fn(),
  },
  StandardFonts: { Helvetica: "Helvetica" },
  rgb: jest.fn((r: number, g: number, b: number) => ({ r, g, b })),
}));

jest.mock("@/lib/pdfSignaturePlacement", () => ({
  findSignaturePlacement: jest.fn(),
}));

jest.mock("@/lib/email", () => ({
  sendSignedDocumentEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const mockedPrisma = prisma as unknown as {
  systemDocument: { findUnique: jest.Mock };
  documentAcknowledgment: { findFirst: jest.Mock; create: jest.Mock };
  user: { findUnique: jest.Mock };
};

const mockedVerifyToken = verifyToken as jest.Mock;
const mockedReadFile = readFile as jest.Mock;
const mockedWriteFile = writeFile as jest.Mock;
const mockedExistsSync = existsSync as jest.Mock;
const mockedPDFDocumentLoad = PDFDocument.load as jest.Mock;
const mockedFindSignaturePlacement = findSignaturePlacement as jest.Mock;
const mockedSendSignedDocumentEmail = sendSignedDocumentEmail as jest.Mock;

const DRIVER_ID = "driver-1";
const DOC_ID = "doc-1";
const SIGNATURE_DATA_URL = "data:image/png;base64,AAAABBBB";

function makePostRequest(body: any, opts: { withAuth?: boolean } = {}) {
  const { withAuth = true } = opts;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (withAuth) headers["authorization"] = "Bearer valid-token";
  return new NextRequest("http://localhost/api/driver/system-documents/sign", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function makePdfDocMock() {
  const page = { drawImage: jest.fn(), drawText: jest.fn() };
  return {
    getPages: jest.fn().mockReturnValue([page]),
    embedPng: jest.fn().mockResolvedValue({}),
    embedFont: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    _page: page,
  };
}

// Flush pending microtasks so the route's fire-and-forget email IIFE has a
// chance to run/settle before assertions that depend on it.
async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("POST /api/driver/system-documents/sign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedWriteFile.mockResolvedValue(undefined);
    mockedReadFile.mockResolvedValue(Buffer.from("fake-pdf-bytes"));
    mockedSendSignedDocumentEmail.mockResolvedValue({ success: true });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: DRIVER_ID,
      username: "jdoe",
      fullName: "John Doe",
    });
    mockedFindSignaturePlacement.mockResolvedValue({ pageIndex: 0, x: 10, y: 20 });
    mockedPDFDocumentLoad.mockResolvedValue(makePdfDocMock());
  });

  it("returns 401 when no Authorization header is present", async () => {
    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL }, { withAuth: false })
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when verifyToken returns null", async () => {
    mockedVerifyToken.mockReturnValue(null);
    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when role !== DRIVER", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "ADMIN" });
    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 when documentId or signatureImageBase64 is missing", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    const response = await POST(makePostRequest({ documentId: DOC_ID }));
    expect(response.status).toBe(400);
  });

  it("returns 404 when the document doesn't exist, is inactive, or is deleted", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue(null);

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 when the document has requiresSignature: false (should use acknowledge endpoint instead)", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
      requiresSignature: false,
      mimeType: "application/pdf",
    });

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/acknowledge instead/);
    expect(mockedPrisma.documentAcknowledgment.create).not.toHaveBeenCalled();
  });

  it("is idempotent: if already signed at the current version, returns 200 'already signed' and does not create a duplicate", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 2,
      requiresSignature: true,
      mimeType: "application/pdf",
    });
    const existingAck = {
      id: "ack-existing",
      documentId: DOC_ID,
      driverId: DRIVER_ID,
      documentVersion: 2,
      isValid: true,
    };
    mockedPrisma.documentAcknowledgment.findFirst.mockResolvedValue(existingAck);

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toMatch(/already signed/i);
    expect(data.acknowledgment).toEqual(existingAck);
    expect(mockedPrisma.documentAcknowledgment.create).not.toHaveBeenCalled();
  });

  it("successful sign for a PDF document: invokes PDF-stamping code path (pdf-lib + findSignaturePlacement), sets signedPdfUrl, creates ack with matching documentVersion and isValid true", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 5,
      requiresSignature: true,
      mimeType: "application/pdf",
      filePath: "/uploads/system-documents/policy.pdf",
      title: "Safety Policy",
      fileName: "policy.pdf",
    });
    mockedPrisma.documentAcknowledgment.findFirst.mockResolvedValue(null);

    const createdAck = {
      id: "ack-new",
      documentId: DOC_ID,
      driverId: DRIVER_ID,
      documentVersion: 5,
      signatureImageUrl: "/uploads/signatures/whatever.png",
      signedPdfUrl: "/uploads/signed-documents/whatever.pdf",
      isValid: true,
    };
    mockedPrisma.documentAcknowledgment.create.mockResolvedValue(createdAck);

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    const data = await response.json();

    expect(response.status).toBe(200);

    // PDF-stamping path invoked
    expect(mockedFindSignaturePlacement).toHaveBeenCalledTimes(1);
    expect(mockedPDFDocumentLoad).toHaveBeenCalledTimes(1);

    // Acknowledgment created with correct documentVersion + signature fields
    expect(mockedPrisma.documentAcknowledgment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: DOC_ID,
          driverId: DRIVER_ID,
          documentVersion: 5,
          signatureImageUrl: expect.stringMatching(/^\/uploads\/signatures\//),
          signedPdfUrl: expect.stringMatching(/^\/uploads\/signed-documents\//),
        }),
      })
    );

    expect(data.acknowledgment).toEqual(createdAck);
    expect(data.acknowledgment.isValid).toBe(true);
    expect(data.signedPdfUrl).toMatch(/^\/uploads\/signed-documents\//);
  });

  it("for non-PDF mimeType documents: skips PDF-stamping, signedPdfUrl stays null, but signatureImageUrl is still saved", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
      requiresSignature: true,
      mimeType: "image/png",
      filePath: "/uploads/system-documents/policy.png",
      title: "Safety Policy",
      fileName: "policy.png",
    });
    mockedPrisma.documentAcknowledgment.findFirst.mockResolvedValue(null);

    const createdAck = {
      id: "ack-new",
      documentId: DOC_ID,
      driverId: DRIVER_ID,
      documentVersion: 1,
      signatureImageUrl: "/uploads/signatures/whatever.png",
      signedPdfUrl: null,
      isValid: true,
    };
    mockedPrisma.documentAcknowledgment.create.mockResolvedValue(createdAck);

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    const data = await response.json();

    expect(response.status).toBe(200);

    // PDF-stamping path skipped
    expect(mockedFindSignaturePlacement).not.toHaveBeenCalled();
    expect(mockedPDFDocumentLoad).not.toHaveBeenCalled();

    expect(mockedPrisma.documentAcknowledgment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signatureImageUrl: expect.stringMatching(/^\/uploads\/signatures\//),
          signedPdfUrl: null,
        }),
      })
    );

    expect(data.signedPdfUrl).toBeNull();
  });

  it("email sending is fire-and-forget: a rejected sendSignedDocumentEmail does NOT fail the overall request", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
      requiresSignature: true,
      mimeType: "image/png",
      filePath: "/uploads/system-documents/policy.png",
      title: "Safety Policy",
      fileName: "policy.png",
    });
    mockedPrisma.documentAcknowledgment.findFirst.mockResolvedValue(null);
    mockedPrisma.documentAcknowledgment.create.mockResolvedValue({
      id: "ack-new",
      documentId: DOC_ID,
      driverId: DRIVER_ID,
      documentVersion: 1,
      signatureImageUrl: "/uploads/signatures/whatever.png",
      signedPdfUrl: null,
      isValid: true,
    });

    mockedSendSignedDocumentEmail.mockRejectedValue(new Error("SMTP down"));

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toMatch(/signed successfully/i);

    // Allow the fire-and-forget email IIFE to settle; its rejection should be
    // caught internally and must not throw/crash the test process.
    await flushMicrotasks();
    expect(mockedSendSignedDocumentEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: DRIVER_ID, role: "DRIVER" });
    mockedPrisma.systemDocument.findUnique.mockRejectedValue(new Error("db down"));

    const response = await POST(
      makePostRequest({ documentId: DOC_ID, signatureImageBase64: SIGNATURE_DATA_URL })
    );
    expect(response.status).toBe(500);
  });
});
