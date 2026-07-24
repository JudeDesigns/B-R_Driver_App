import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * GET /api/admin/system-documents/[id]
 * Get a specific system document with acknowledgment details
 */
export async function GET(
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

    const document = await prisma.systemDocument.findUnique({
      where: { id, isDeleted: false },
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

    if (!document) {
      return NextResponse.json(
        { message: "System document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching system document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/system-documents/[id]
 * Update a system document
 */
export async function PATCH(
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
    const body = await request.json();

    const { title, description, documentType, category, isRequired, isActive, requiresSignature } = body;

    const existingDocument = await prisma.systemDocument.findUnique({
      where: { id, isDeleted: false },
      select: { requiresSignature: true },
    });

    // Build update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (documentType !== undefined) updateData.documentType = documentType;
    if (category !== undefined) updateData.category = category;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (requiresSignature !== undefined) updateData.requiresSignature = requiresSignature;

    // If signature is newly being turned on for a document that was
    // previously plain-acknowledge (or vice versa - the requirement itself
    // changed), bump the version. This invalidates any existing
    // acknowledgments (which were scoped to the old version/requirement),
    // so drivers who already acknowledged it in the past will see it
    // reappear on their Safety Checklist and be prompted to sign it.
    if (
      existingDocument &&
      requiresSignature !== undefined &&
      requiresSignature !== existingDocument.requiresSignature
    ) {
      updateData.version = { increment: 1 };
    }

    const document = await prisma.systemDocument.update({
      where: { id, isDeleted: false },
      data: updateData,
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
      message: "System document updated successfully",
      document,
    });
  } catch (error) {
    console.error("Error updating system document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/system-documents/[id]
 * Soft delete a system document
 */
export async function DELETE(
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

    // Soft delete the document
    const document = await prisma.systemDocument.update({
      where: { id, isDeleted: false },
      data: {
        isDeleted: true,
        isActive: false,
      },
    });

    return NextResponse.json({
      message: "System document deleted successfully",
      document,
    });
  } catch (error) {
    console.error("Error deleting system document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

