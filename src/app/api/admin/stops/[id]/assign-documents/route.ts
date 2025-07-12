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

    const stopId = params.id;
    const { documentIds } = await request.json();

    if (!documentIds || !Array.isArray(documentIds)) {
      return NextResponse.json(
        { message: "Document IDs array is required" },
        { status: 400 }
      );
    }

    // Verify the stop exists
    const stop = await prisma.stop.findUnique({
      where: { id: stopId, isDeleted: false },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found" },
        { status: 404 }
      );
    }

    // Verify all documents exist and are active
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        isActive: true,
        isDeleted: false,
      },
    });

    if (documents.length !== documentIds.length) {
      return NextResponse.json(
        { message: "One or more documents not found or inactive" },
        { status: 400 }
      );
    }

    // Remove existing assignments for this stop
    await prisma.stopDocument.deleteMany({
      where: { stopId },
    });

    // Create new assignments
    const assignments = await Promise.all(
      documentIds.map((documentId: string) =>
        prisma.stopDocument.create({
          data: {
            stopId,
            documentId,
          },
        })
      )
    );

    return NextResponse.json({
      message: "Documents assigned successfully",
      assignedCount: assignments.length,
    });
  } catch (error) {
    console.error("Error assigning documents to stop:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get documents assigned to a stop
export async function GET(
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

    const stopId = params.id;

    // Get assigned documents for this stop
    const stopDocuments = await prisma.stopDocument.findMany({
      where: {
        stopId,
        isDeleted: false,
        document: {
          isDeleted: false, // Filter out deleted documents
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            description: true,
            type: true,
            fileName: true,
            filePath: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(stopDocuments);
  } catch (error) {
    console.error("Error fetching stop documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
