import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * POST /api/driver/system-documents/acknowledge
 * Acknowledge a system document
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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const driverId = decoded.id;
    const body = await request.json();
    const { documentId, routeId } = body;

    if (!documentId) {
      return NextResponse.json(
        { message: "Document ID is required" },
        { status: 400 }
      );
    }

    // Verify the document exists and is active
    const document = await prisma.systemDocument.findUnique({
      where: { id: documentId, isActive: true, isDeleted: false },
    });

    if (!document) {
      return NextResponse.json(
        { message: "Document not found or inactive" },
        { status: 404 }
      );
    }

    // Check if already acknowledged for this specific route
    // Use findFirst because routeId can be null, which findUnique doesn't handle well for composite keys
    const existingAcknowledgment = await prisma.documentAcknowledgment.findFirst({
      where: {
        documentId,
        driverId,
        routeId: routeId || null,
      } as any,
    });

    if (existingAcknowledgment) {
      return NextResponse.json({
        message: "Document already acknowledged",
        acknowledgment: existingAcknowledgment,
      });
    }

    // Get client IP and user agent for audit trail
    const ipAddress = request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Create acknowledgment
    const acknowledgment = await prisma.documentAcknowledgment.create({
      data: {
        documentId,
        driverId,
        routeId: routeId || null,
        ipAddress,
        userAgent,
      } as any,
      include: {
        document: {
          select: {
            id: true,
            title: true,
            documentType: true,
            category: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Document acknowledged successfully",
      acknowledgment,
    });
  } catch (error) {
    console.error("Error acknowledging document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/driver/system-documents/acknowledge
 * Get unacknowledged required documents for the driver
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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const driverId = decoded.id;
    const url = new URL(request.url);
    const routeId = url.searchParams.get("routeId");

    // Get all required documents
    const requiredDocuments = await prisma.systemDocument.findMany({
      where: {
        isRequired: true,
        isActive: true,
        isDeleted: false,
      },
      include: {
        acknowledgments: {
          where: {
            driverId: driverId,
            routeId: routeId || null,
          } as any,
        },
      },
    });

    // Filter to only unacknowledged documents
    const unacknowledgedDocuments = (requiredDocuments as any[]).filter(
      doc => doc.acknowledgments.length === 0
    );

    return NextResponse.json({
      unacknowledgedCount: unacknowledgedDocuments.length,
      documents: unacknowledgedDocuments,
    });
  } catch (error) {
    console.error("Error fetching unacknowledged documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

