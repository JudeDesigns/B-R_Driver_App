import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/driver/system-documents
 * Fetch active system documents with acknowledgment status for the driver
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
        const type = url.searchParams.get("type");
        const category = url.searchParams.get("category");
        const isRequired = url.searchParams.get("isRequired");

        const whereClause: any = {
            isActive: true,
            isDeleted: false,
        };

        if (type) {
            whereClause.documentType = type;
        }

        if (category) {
            whereClause.category = category;
        }

        if (isRequired !== null && isRequired !== undefined) {
            whereClause.isRequired = isRequired === "true";
        }

        // Fetch documents with acknowledgment status. Acknowledgment status is
        // now a lifetime + version concept: only the latest valid
        // acknowledgment matching the document's CURRENT version counts as
        // "acknowledged"/"signed" for this driver.
        const documents = await prisma.systemDocument.findMany({
            where: whereClause,
            include: {
                acknowledgments: {
                    where: {
                        driverId: driverId,
                        isValid: true,
                    },
                    orderBy: {
                        acknowledgedAt: "desc",
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Transform the response to include isAcknowledged flag plus
        // signature-related fields for the current version.
        const documentsWithStatus = documents.map(doc => {
            const currentValidAck = doc.acknowledgments.find(
                (ack) => ack.documentVersion === doc.version
            );
            const { acknowledgments, ...rest } = doc;
            return {
                ...rest,
                isAcknowledged: !!currentValidAck,
                acknowledgedAt: currentValidAck?.acknowledgedAt || null,
                requiresSignature: doc.requiresSignature,
                signedPdfUrl: currentValidAck?.signedPdfUrl || null,
                documentVersion: doc.version,
                currentVersion: doc.version,
            };
        });

        return NextResponse.json({ documents: documentsWithStatus });
    } catch (error) {
        console.error("Error fetching system documents:", error);
        return NextResponse.json(
            { message: "Failed to fetch documents" },
            { status: 500 }
        );
    }
}
