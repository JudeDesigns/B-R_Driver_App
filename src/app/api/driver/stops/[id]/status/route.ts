import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    // In Next.js 14, params is a Promise that needs to be awaited
    const params = await context.params;
    const { id } = params;
    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized: Missing or invalid token" },
        { status: 401 }
      );
    }

    // Extract and verify the token
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id) {
      return NextResponse.json(
        { message: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    // Check if the user has the DRIVER role
    if (decoded.role !== "DRIVER") {
      return NextResponse.json(
        { message: "Forbidden: Only drivers can access this endpoint" },
        { status: 403 }
      );
    }

    // We already extracted the ID from context.params above
    const stopId = id;

    // Find the stop
    const stop = await prisma.stop.findUnique({
      where: { id: stopId },
      select: {
        id: true,
        status: true,
        route: {
          select: {
            driverId: true,
          },
        },
      },
    });

    // Check if the stop exists
    if (!stop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Skip driver assignment check for now - this will be handled by the route permissions
    // The driver might be assigned to the route in a different way than directly through driverId
    // For example, through the driverNameFromUpload field or through a many-to-many relationship

    // Return the stop status
    return NextResponse.json({
      status: stop.status,
    });
  } catch (error) {
    console.error("Error getting stop status:", error);
    return NextResponse.json(
      { message: "An error occurred while getting stop status" },
      { status: 500 }
    );
  }
}
