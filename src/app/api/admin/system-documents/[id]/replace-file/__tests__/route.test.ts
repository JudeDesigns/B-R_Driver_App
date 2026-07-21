/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "../route";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    systemDocument: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

const mockedPrisma = prisma as unknown as {
  systemDocument: { findUnique: jest.Mock; update: jest.Mock };
};

const mockedVerifyToken = verifyToken as jest.Mock;
const mockedWriteFile = writeFile as jest.Mock;
const mockedExistsSync = existsSync as jest.Mock;

const DOC_ID = "doc-1";

function makeParams(id: string = DOC_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(opts: {
  withAuth?: boolean;
  file?: File | null;
  omitFile?: boolean;
} = {}) {
  const { withAuth = true, file, omitFile = false } = opts;
  const headers: Record<string, string> = {};
  if (withAuth) headers["authorization"] = "Bearer valid-token";

  const formData = new FormData();
  if (!omitFile) {
    const theFile =
      file !== undefined
        ? file
        : new File(["%PDF-1.4 fake pdf content"], "policy.pdf", {
            type: "application/pdf",
          });
    if (theFile) {
      formData.append("file", theFile);
    }
  }

  return new NextRequest(
    `http://localhost/api/admin/system-documents/${DOC_ID}/replace-file`,
    {
      method: "POST",
      headers,
      body: formData,
    }
  );
}

describe("POST /api/admin/system-documents/[id]/replace-file", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedWriteFile.mockResolvedValue(undefined);
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

  it("returns 401 when role is DRIVER (non-admin/non-super-admin)", async () => {
    mockedVerifyToken.mockReturnValue({ id: "u1", role: "DRIVER" });
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(401);
  });

  it("returns 404 when the document doesn't exist / is deleted", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue(null);

    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
    expect(mockedPrisma.systemDocument.findUnique).toHaveBeenCalledWith({
      where: { id: DOC_ID, isDeleted: false },
    });
  });

  it("returns 400 when no file is provided", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
    });

    const response = await POST(makeRequest({ omitFile: true }), makeParams());
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/File is required/);
  });

  it("returns 400 when the file type is invalid", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 1,
    });

    const badFile = new File(["exe content"], "virus.exe", {
      type: "application/x-msdownload",
    });

    const response = await POST(makeRequest({ file: badFile }), makeParams());
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/Invalid file type/);
  });

  it("successfully replaces the file: bumps version, updates file metadata, leaves acknowledgments alone", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.systemDocument.findUnique.mockResolvedValue({
      id: DOC_ID,
      version: 3,
      filePath: "/uploads/system-documents/old.pdf",
      fileName: "old.pdf",
      fileSize: 100,
      mimeType: "application/pdf",
    });

    const existingAcknowledgments = [
      { id: "ack-1", documentId: DOC_ID, driverId: "driver-1", documentVersion: 3 },
    ];
    const updatedDocument = {
      id: DOC_ID,
      version: 4,
      filePath: "/uploads/system-documents/123_policy.pdf",
      fileName: "policy.pdf",
      fileSize: 25,
      mimeType: "application/pdf",
      acknowledgments: existingAcknowledgments,
    };
    mockedPrisma.systemDocument.update.mockResolvedValue(updatedDocument);

    const newFile = new File(["%PDF new content"], "policy.pdf", {
      type: "application/pdf",
    });

    const response = await POST(makeRequest({ file: newFile }), makeParams());

    expect(response.status).toBe(200);
    expect(mockedPrisma.systemDocument.update).toHaveBeenCalledTimes(1);
    const updateCallArgs = mockedPrisma.systemDocument.update.mock.calls[0][0];
    expect(updateCallArgs.where).toEqual({ id: DOC_ID, isDeleted: false });
    expect(updateCallArgs.data.version).toBe(4); // bumped by 1 from existing version 3
    expect(updateCallArgs.data.fileName).toBe("policy.pdf");
    expect(updateCallArgs.data.mimeType).toBe("application/pdf");
    expect(typeof updateCallArgs.data.fileSize).toBe("number");
    expect(updateCallArgs.data.filePath).toMatch(/^\/uploads\/system-documents\//);

    // Acknowledgments were not deleted/modified - the update call only touched
    // version/filePath/fileName/fileSize/mimeType fields.
    expect(updateCallArgs.data).not.toHaveProperty("acknowledgments");

    const data = await response.json();
    expect(data.document).toEqual(updatedDocument);
    expect(data.document.acknowledgments).toEqual(existingAcknowledgments);
  });

  it("returns 500 when prisma throws", async () => {
    mockedVerifyToken.mockReturnValue({ id: "admin-1", role: "ADMIN" });
    mockedPrisma.systemDocument.findUnique.mockRejectedValue(new Error("db down"));

    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(500);
  });
});
