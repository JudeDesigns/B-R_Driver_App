import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

/**
 * GET /api/admin/system-documents
 * Fetch all system documents with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const documentType = searchParams.get("documentType");
    const isRequired = searchParams.get("isRequired");
    const isActive = searchParams.get("isActive");
    const searchQuery = searchParams.get("search");

    // Build where clause
    const where: any = {
      isDeleted: false,
    };

    if (category) {
      where.category = category;
    }

    if (documentType) {
      where.documentType = documentType;
    }

    if (isRequired !== null && isRequired !== undefined) {
      where.isRequired = isRequired === "true";
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { description: { contains: searchQuery, mode: "insensitive" } },
        { fileName: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    // Get system documents
    const documents = await prisma.systemDocument.findMany({
      where,
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            acknowledgments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Error fetching system documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/system-documents
 * Upload a new system document
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const documentType = formData.get("documentType") as string;
    const category = formData.get("category") as string;
    const isRequired = formData.get("isRequired") === "true";

    // Validate required fields
    if (!file || !title || !documentType || !category) {
      return NextResponse.json(
        { message: "File, title, document type, and category are required" },
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

    // Create database record
    const document = await prisma.systemDocument.create({
      data: {
        title,
        description: description || null,
        documentType: documentType as any,
        category: category as any,
        filePath: `/uploads/system-documents/${fileName}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        isRequired,
        uploadedBy: decoded.id,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            acknowledgments: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "System document uploaded successfully",
      document,
    });
  } catch (error) {
    console.error("Error uploading system document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}


