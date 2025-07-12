import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using its properties (Next.js 15 requirement)
    const { id } = await params;

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

    const document = await prisma.document.findFirst({
      where: {
        id: id,
        isDeleted: false,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        stopDocuments: {
          where: {
            isDeleted: false,
          },
          include: {
            stop: {
              select: {
                id: true,
                sequence: true,
                customerNameFromUpload: true,
                route: {
                  select: {
                    id: true,
                    routeNumber: true,
                    date: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using its properties (Next.js 15 requirement)
    const { id } = await params;

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

    const body = await request.json();
    const { title, description, type, isActive } = body;

    const document = await prisma.document.findFirst({
      where: {
        id: id,
        isDeleted: false,
      },
    });

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    const updatedDocument = await prisma.document.update({
      where: {
        id: id,
      },
      data: {
        title: title || document.title,
        description: description !== undefined ? description : document.description,
        type: type || document.type,
        isActive: isActive !== undefined ? isActive : document.isActive,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Document updated successfully",
      document: updatedDocument,
    });
  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params before using its properties (Next.js 15 requirement)
    const { id } = await params;

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ message: "Invalid document ID format" }, { status: 400 });
    }

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

    const document = await prisma.document.findFirst({
      where: {
        id: id,
        isDeleted: false,
      },
      include: {
        stopDocuments: {
          where: {
            isDeleted: false,
          },
        },
      },
    });



    if (!document) {
      // Check if the document exists but is already deleted
      const deletedDocument = await prisma.document.findFirst({
        where: {
          id: id,
        },
        include: {
          stopDocuments: true,
        },
      });

      if (deletedDocument && deletedDocument.isDeleted) {
        // Document is already deleted, return success
        return NextResponse.json({
          message: "Document already deleted",
        });
      }

      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    // First, soft delete any related stop documents
    await prisma.stopDocument.updateMany({
      where: {
        documentId: id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });

    // Then soft delete the document itself
    await prisma.document.update({
      where: {
        id: id,
      },
      data: {
        isDeleted: true,
      },
    });

    // Optionally delete the physical file
    try {
      const fullPath = path.join(process.cwd(), "public", document.filePath);
      await unlink(fullPath);
    } catch (fileError) {
      console.warn("Could not delete physical file:", fileError);
      // Continue even if file deletion fails
    }

    return NextResponse.json({
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
