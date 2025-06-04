import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json();
    const { stopIds } = body;

    if (!stopIds || !Array.isArray(stopIds) || stopIds.length === 0) {
      return NextResponse.json(
        { message: "Stop IDs are required" },
        { status: 400 }
      );
    }

    // Verify document exists
    const document = await prisma.document.findFirst({
      where: {
        id: params.id,
        isDeleted: false,
        isActive: true,
      },
    });

    if (!document) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    // Verify all stops exist
    const stops = await prisma.stop.findMany({
      where: {
        id: {
          in: stopIds,
        },
        isDeleted: false,
      },
    });

    if (stops.length !== stopIds.length) {
      return NextResponse.json(
        { message: "One or more stops not found" },
        { status: 404 }
      );
    }

    // Create assignments (use upsert to handle duplicates)
    const assignments = await Promise.all(
      stopIds.map(async (stopId: string) => {
        return prisma.stopDocument.upsert({
          where: {
            stopId_documentId: {
              stopId,
              documentId: params.id,
            },
          },
          update: {
            isDeleted: false, // Reactivate if it was soft deleted
          },
          create: {
            stopId,
            documentId: params.id,
          },
        });
      })
    );

    return NextResponse.json({
      message: "Document assigned to stops successfully",
      assignments: assignments.length,
    });
  } catch (error) {
    console.error("Error assigning document to stops:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json();
    const { stopIds } = body;

    if (!stopIds || !Array.isArray(stopIds) || stopIds.length === 0) {
      return NextResponse.json(
        { message: "Stop IDs are required" },
        { status: 400 }
      );
    }

    // Remove assignments
    await prisma.stopDocument.updateMany({
      where: {
        documentId: params.id,
        stopId: {
          in: stopIds,
        },
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({
      message: "Document unassigned from stops successfully",
    });
  } catch (error) {
    console.error("Error unassigning document from stops:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
