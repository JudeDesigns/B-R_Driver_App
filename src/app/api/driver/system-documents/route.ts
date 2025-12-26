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

        // Fetch documents with acknowledgment status
        const documents = await prisma.systemDocument.findMany({
            where: whereClause,
            include: {
                acknowledgments: {
                    where: {
                        driverId: driverId,
                    },
                    select: {
                        id: true,
                        acknowledgedAt: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        // Transform the response to include isAcknowledged flag
        const documentsWithStatus = documents.map(doc => ({
            ...doc,
            isAcknowledged: doc.acknowledgments.length > 0,
            acknowledgedAt: doc.acknowledgments[0]?.acknowledgedAt || null,
        }));

        return NextResponse.json({ documents: documentsWithStatus });
    } catch (error) {
        console.error("Error fetching system documents:", error);
        return NextResponse.json(
            { message: "Failed to fetch documents" },
            { status: 500 }
        );
    }
}
