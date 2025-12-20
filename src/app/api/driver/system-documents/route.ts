import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/driver/system-documents
 * Fetch active system documents (e.g., Safety Instructions)
 * Note: Requires generated Prisma Client to include SystemDocument model
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

        const url = new URL(request.url);
        const type = url.searchParams.get("type");

        const whereClause: any = {
            isActive: true,
            isDeleted: false,
        };

        if (type) {
            whereClause.documentType = type;
        }

        const documents = await prisma.systemDocument.findMany({
            where: whereClause,
            orderBy: {
                createdAt: "desc",
            },
        });

        return NextResponse.json({ documents });
    } catch (error) {
        console.error("Error fetching system documents:", error);
        return NextResponse.json(
            { message: "Failed to fetch documents" },
            { status: 500 }
        );
    }
}
