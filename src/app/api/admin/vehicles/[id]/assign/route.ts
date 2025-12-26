import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * POST /api/admin/vehicles/[id]/assign
 * Assign a driver to a vehicle
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify authentication
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token) as any;

        if (!decoded || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const data = await request.json();

        if (!data.driverId) {
            return NextResponse.json(
                { message: "Driver ID is required" },
                { status: 400 }
            );
        }

        // Check if vehicle exists
        const vehicle = await prisma.vehicle.findUnique({
            where: { id },
        });

        if (!vehicle || vehicle.isDeleted) {
            return NextResponse.json(
                { message: "Vehicle not found" },
                { status: 404 }
            );
        }

        // Check if driver exists
        const driver = await prisma.user.findUnique({
            where: { id: data.driverId },
        });

        if (!driver || driver.isDeleted || driver.role !== "DRIVER") {
            return NextResponse.json(
                { message: "Driver not found or invalid role" },
                { status: 404 }
            );
        }

        // Deactivate current active assignment for this vehicle if exists
        await prisma.vehicleAssignment.updateMany({
            where: {
                vehicleId: id,
                isActive: true,
            },
            data: {
                isActive: false,
            },
        });

        // Create new assignment
        const assignment = await prisma.vehicleAssignment.create({
            data: {
                vehicleId: id,
                driverId: data.driverId,
                assignedBy: decoded.id,
                isActive: true,
                notes: data.notes,
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
            message: "Driver assigned successfully",
            assignment
        });
    } catch (error) {
        console.error("Error assigning driver:", error);
        return NextResponse.json(
            { message: "Failed to assign driver" },
            { status: 500 }
        );
    }
}
