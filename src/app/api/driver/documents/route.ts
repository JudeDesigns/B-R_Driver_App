
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);

        if (!decoded || !decoded.id) {
            return NextResponse.json({ message: "Invalid token" }, { status: 401 });
        }

        const driverId = decoded.id;

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Find active route for the driver
        const route = await prisma.route.findFirst({
            where: {
                driverId: driverId,
                date: {
                    gte: today,
                    lt: tomorrow,
                },
                status: {
                    in: ["PENDING", "IN_PROGRESS"],
                },
            },
            include: {
                stops: {
                    include: {
                        stopDocuments: {
                            include: {
                                document: true,
                            },
                        },
                    },
                },
            },
        });

        if (!route) {
            return NextResponse.json([]);
        }

        // Return the stops with their documents
        return NextResponse.json(route.stops);

    } catch (error) {
        console.error("Error fetching driver documents:", error);
        return NextResponse.json(
            { message: "Internal server error" },
            { status: 500 }
        );
    }
}
