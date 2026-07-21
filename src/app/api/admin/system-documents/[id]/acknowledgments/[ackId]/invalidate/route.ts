import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

/**
 * POST /api/admin/system-documents/[id]/acknowledgments/[ackId]/invalidate
 * Mark a single DocumentAcknowledgment row as invalid (e.g. to "reopen" the
 * e-signature requirement for a specific driver). Does NOT delete the row -
 * the old signature image/signed PDF path stays intact for audit purposes,
 * it's just flagged invalid so it no longer counts as the driver's current
 * valid acknowledgment/signature.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ackId: string }> }
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

    const { id, ackId } = await params;

    const acknowledgment = await prisma.documentAcknowledgment.findUnique({
      where: { id: ackId },
    });

    if (!acknowledgment || acknowledgment.documentId !== id) {
      return NextResponse.json(
        { message: "Acknowledgment not found" },
        { status: 404 }
      );
    }

    const updatedAcknowledgment = await prisma.documentAcknowledgment.update({
      where: { id: ackId },
      data: {
        isValid: false,
        invalidatedAt: new Date(),
        invalidatedBy: decoded.id,
      },
      include: {
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Acknowledgment invalidated successfully",
      acknowledgment: updatedAcknowledgment,
    });
  } catch (error) {
    console.error("Error invalidating acknowledgment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
