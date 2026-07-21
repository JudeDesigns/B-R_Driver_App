import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { findSignaturePlacement } from "@/lib/pdfSignaturePlacement";
import { sendSignedDocumentEmail } from "@/lib/email";

/**
 * POST /api/driver/system-documents/sign
 * Capture a driver's drawn signature for a document that requires signature
 * (SystemDocument.requiresSignature === true). Stamps the signature onto the
 * source PDF (if applicable) using whitespace-aware placement, stores the
 * resulting files, creates a DocumentAcknowledgment row, and emails copies to
 * the office (and the driver, if an email address is available).
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
    const { documentId, signatureImageBase64, routeId } = body;

    if (!documentId || !signatureImageBase64) {
      return NextResponse.json(
        { message: "Document ID and signature image are required" },
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

    if (!document.requiresSignature) {
      return NextResponse.json(
        {
          message:
            "This document does not require a signature. Use /api/driver/system-documents/acknowledge instead.",
        },
        { status: 400 }
      );
    }

    // Idempotency: check for an existing current valid acknowledgment
    // (lifetime + version scoped, not route-scoped).
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
        message: "Document already signed",
        acknowledgment: existingAcknowledgment,
      });
    }

    // Get client IP and user agent for audit trail
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Decode the base64 signature PNG data URL
    const base64Match = signatureImageBase64.match(/^data:image\/png;base64,(.+)$/);
    const base64Data = base64Match ? base64Match[1] : signatureImageBase64;
    const signatureBuffer = Buffer.from(base64Data, "base64");

    // Save the raw signature image
    const signaturesDir = path.join(process.cwd(), "public", "uploads", "signatures");
    if (!existsSync(signaturesDir)) {
      await mkdir(signaturesDir, { recursive: true });
    }

    const timestamp = Date.now();
    const signatureFileName = `${documentId}_${driverId}_${timestamp}.png`;
    const signatureFilePath = path.join(signaturesDir, signatureFileName);
    await writeFile(signatureFilePath, signatureBuffer);
    const signatureImageUrl = `/uploads/signatures/${signatureFileName}`;

    const acknowledgedAt = new Date();

    // Fetch driver info for the "Signed by ..." label and email.
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, username: true, fullName: true },
    });
    const driverDisplayName = driver?.fullName || driver?.username || "Driver";
    // NOTE: The User model has no `email` field in the current schema, so we
    // cannot email the driver directly. We only email the office in that
    // case. If an email field is added to User in the future, populate
    // driverEmail below from it.
    const driverEmail: string | null = null;

    let signedPdfUrl: string | null = null;

    if (document.mimeType === "application/pdf") {
      try {
        const sourcePdfPath = path.join(process.cwd(), "public", document.filePath);
        const sourcePdfBytes = await readFile(sourcePdfPath);

        const placement = await findSignaturePlacement(sourcePdfBytes);

        const pdfDoc = await PDFDocument.load(sourcePdfBytes, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();
        const targetPage = pages[placement.pageIndex] || pages[pages.length - 1];

        const signatureImageEmbed = await pdfDoc.embedPng(signatureBuffer);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const SIG_WIDTH = 180;
        const SIG_HEIGHT = 60;

        targetPage.drawImage(signatureImageEmbed, {
          x: placement.x,
          y: placement.y,
          width: SIG_WIDTH,
          height: SIG_HEIGHT,
        });

        const label = `Signed by ${driverDisplayName} on ${acknowledgedAt.toLocaleString()}`;
        targetPage.drawText(label, {
          x: placement.x,
          y: Math.max(placement.y - 12, 2),
          size: 8,
          font,
          color: rgb(0, 0, 0),
        });

        const signedPdfBytes = await pdfDoc.save();

        const signedDocsDir = path.join(process.cwd(), "public", "uploads", "signed-documents");
        if (!existsSync(signedDocsDir)) {
          await mkdir(signedDocsDir, { recursive: true });
        }

        const signedPdfFileName = `${documentId}_${driverId}_${timestamp}.pdf`;
        const signedPdfFilePath = path.join(signedDocsDir, signedPdfFileName);
        await writeFile(signedPdfFilePath, signedPdfBytes);
        signedPdfUrl = `/uploads/signed-documents/${signedPdfFileName}`;
      } catch (stampError) {
        console.error("Error stamping signature onto PDF:", stampError);
        // Continue without a signed PDF rather than failing the whole
        // signing flow - the raw signature image is still saved/recorded.
      }
    }

    // Create acknowledgment
    const acknowledgment = await prisma.documentAcknowledgment.create({
      data: {
        documentId,
        driverId,
        routeId: routeId || null,
        documentVersion: document.version,
        signatureImageUrl,
        signedPdfUrl,
        acknowledgedAt,
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

    // Fire-and-forget email notification (don't block/fail the response).
    (async () => {
      try {
        const attachments: { filename: string; content: Buffer; contentType?: string }[] = [];

        if (signedPdfUrl) {
          const signedPdfFullPath = path.join(process.cwd(), "public", signedPdfUrl);
          const signedPdfBuffer = await readFile(signedPdfFullPath);
          attachments.push({
            filename: `${document.title.replace(/[^a-zA-Z0-9.-]/g, "_")}-signed.pdf`,
            content: signedPdfBuffer,
            contentType: "application/pdf",
          });
        } else {
          // Non-PDF document (image/Word) - attach original doc + signature
          // image separately.
          try {
            const originalFullPath = path.join(process.cwd(), "public", document.filePath);
            const originalBuffer = await readFile(originalFullPath);
            attachments.push({
              filename: document.fileName,
              content: originalBuffer,
              contentType: document.mimeType,
            });
          } catch (readOriginalError) {
            console.error("Error reading original document for email:", readOriginalError);
          }
        }

        attachments.push({
          filename: `signature-${signatureFileName}`,
          content: signatureBuffer,
          contentType: "image/png",
        });

        await sendSignedDocumentEmail({
          documentTitle: document.title,
          driverName: driverDisplayName,
          driverEmail,
          signedAt: acknowledgedAt,
          attachments,
        });
      } catch (emailError) {
        console.error("Error sending signed document notification email:", emailError);
      }
    })();

    return NextResponse.json({
      message: "Document signed successfully",
      acknowledgment,
      signedPdfUrl,
    });
  } catch (error) {
    console.error("Error signing document:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
