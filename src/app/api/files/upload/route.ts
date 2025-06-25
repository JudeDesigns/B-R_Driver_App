import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { fileManager, FileUploadOptions } from "@/lib/fileManager";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const category = formData.get("category") as string;
    const subCategory = formData.get("subCategory") as string;
    const generateThumbnails = formData.get("generateThumbnails") === "true";
    const compress = formData.get("compress") === "true";
    const quality = parseInt(formData.get("quality") as string) || 80;
    const metadataStr = formData.get("metadata") as string;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { message: "Category is required" },
        { status: 400 }
      );
    }

    // Validate category against database categories
    const validCategory = await prisma.fileCategory.findUnique({
      where: { name: category },
    });

    if (!validCategory) {
      return NextResponse.json(
        { message: `Invalid category: ${category}. Available categories can be found in the file management system.` },
        { status: 400 }
      );
    }

    // Parse metadata
    let metadata = {};
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (error) {
        return NextResponse.json(
          { message: "Invalid metadata JSON" },
          { status: 400 }
        );
      }
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload options
    const options: FileUploadOptions = {
      category: category as any,
      subCategory: subCategory || undefined,
      generateThumbnails,
      compress,
      quality,
      metadata,
    };

    // Upload file using file manager
    const fileRecord = await fileManager.uploadFile(
      fileBuffer,
      file.name,
      file.type,
      decoded.id,
      options
    );

    return NextResponse.json({
      message: "File uploaded successfully",
      file: fileRecord,
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to list files
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const archived = searchParams.get("archived") === "true";

    // Build where clause
    const where: any = {
      isDeleted: false,
      isArchived: archived,
    };

    if (category) {
      where.category = { name: category };
    }

    // Fetch files
    const files = await prisma.file.findMany({
      where,
      include: {
        category: true,
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        thumbnails: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    // Get total count
    const totalCount = await prisma.file.count({ where });

    return NextResponse.json({
      files,
      totalCount,
      hasMore: offset + limit < totalCount,
    });

  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get file ID from query parameters
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
      return NextResponse.json(
        { message: "File ID is required" },
        { status: 400 }
      );
    }

    // Get file record
    const file = await prisma.file.findUnique({
      where: { id: fileId, isDeleted: false },
    });

    if (!file) {
      return NextResponse.json(
        { message: "File not found" },
        { status: 404 }
      );
    }

    // Mark file as deleted (soft delete)
    await prisma.file.update({
      where: { id: fileId },
      data: {
        isDeleted: true,
        updatedAt: new Date(),
      },
    });

    // Optionally, you could also delete the physical file here
    // const fs = require('fs').promises;
    // const path = require('path');
    // const fullPath = path.join(process.cwd(), 'uploads', file.filePath);
    // try {
    //   await fs.unlink(fullPath);
    // } catch (error) {
    //   console.error('Failed to delete physical file:', error);
    // }

    return NextResponse.json({
      message: "File deleted successfully",
    });

  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
