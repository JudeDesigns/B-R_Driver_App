import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * POST /api/driver/system-documents/acknowledge
 * Acknowledge a system document (simple "I Have Read This" flow).
 * Only valid for documents where requiresSignature === false. Use
 * /api/driver/system-documents/sign for documents that require a signature.
 *
 * Acknowledgment is now a lifetime + version concept: a driver only needs to
 * acknowledge a document once per document version (not once per route). The
 * routeId is still accepted/stored for audit/back-compat purposes but no
 * longer scopes the "already acknowledged" check.
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

    if (document.requiresSignature) {
      return NextResponse.json(
        {
          message:
            "This document requires a signature. Use /api/driver/system-documents/sign instead.",
        },
        { status: 400 }
      );
    }

    // Check for an existing current valid acknowledgment (lifetime + version
    // scoped - the latest valid row matching the document's current version).
    const existingAcknowledgment = await prisma.documentAcknowledgment.findFirst({
      where: {
        documentId,
        driverId,
        documentVersion: document.version,
        isValid: true,
      },
      orderBy: {
        acknowledgedAt: "desc",
      },
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
        documentVersion: document.version,
        ipAddress,
        userAgent,
      },
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
 * Get required documents that the driver has not yet satisfied (acknowledged
 * or signed, depending on requiresSignature) for the CURRENT version of each
 * document. routeId is still accepted as a query param for backward
 * compatibility/logging but no longer scopes the "already satisfied" check.
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
    // Accepted for backward compatibility/logging only - no longer used to
    // scope the "already satisfied" check (lifetime + version model).
    const routeId = url.searchParams.get("routeId");
    void routeId;

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
            driverId,
            isValid: true,
          },
          orderBy: {
            acknowledgedAt: "desc",
          },
        },
      },
    });

    // Filter to only documents where the driver has no valid acknowledgment
    // matching the document's CURRENT version.
    const unsatisfiedDocuments = requiredDocuments.filter((doc) => {
      const currentValidAck = doc.acknowledgments.find(
        (ack) => ack.documentVersion === doc.version
      );
      return !currentValidAck;
    });

    const documents = unsatisfiedDocuments.map((doc) => {
      const { acknowledgments, ...rest } = doc;
      return {
        ...rest,
        requiresSignature: doc.requiresSignature,
      };
    });

    return NextResponse.json({
      unacknowledgedCount: documents.length,
      documents,
    });
  } catch (error) {
    console.error("Error fetching unacknowledged documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
