import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

/**
 * POST /api/admin/system-documents/[id]/replace-file
 * Upload a new version of an existing system document's file.
 * Bumps SystemDocument.version, updates filePath/fileName/fileSize/mimeType.
 * Existing DocumentAcknowledgment rows are left untouched (they remain valid
 * historical records of the OLD version and will naturally stop counting as
 * "current" once the document's version number has been bumped).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existingDocument = await prisma.systemDocument.findUnique({
      where: { id, isDeleted: false },
    });

    if (!existingDocument) {
      return NextResponse.json(
        { message: "System document not found" },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "File is required" },
        { status: 400 }
      );
    }

    // Validate file type (allow PDFs and common document formats)
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/jpg",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "Invalid file type. Only PDF, Word documents, and images are allowed" },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}_${sanitizedFileName}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads", "system-documents");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    // Bump version and update file metadata only (title/description/category/etc
    // are managed separately via PATCH)
    const document = await prisma.systemDocument.update({
      where: { id, isDeleted: false },
      data: {
        version: existingDocument.version + 1,
        filePath: `/uploads/system-documents/${fileName}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        acknowledgments: {
          include: {
            driver: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
          orderBy: {
            acknowledgedAt: "desc",
          },
        },
      },
    });

    return NextResponse.json({
      message: "System document file replaced successfully",
      document,
    });
  } catch (error) {
    console.error("Error replacing system document file:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
