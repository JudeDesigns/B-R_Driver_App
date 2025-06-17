import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * DELETE /api/admin/routes/[id]/delete - Delete a route and all its associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Unauthorized: Super Admin access required for route deletion" },
        { status: 403 }
      );
    }

    const routeId = params.id;

    // Verify the route exists and get its details
    const route = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        stops: {
          where: { isDeleted: false },
          select: { id: true, status: true },
        },
        _count: {
          select: {
            stops: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json(
        { message: "Route not found" },
        { status: 404 }
      );
    }

    // Check if route has any completed stops
    const completedStops = route.stops.filter(stop => stop.status === "COMPLETED");
    const hasCompletedStops = completedStops.length > 0;

    // Parse query parameters for force delete
    const url = new URL(request.url);
    const forceDelete = url.searchParams.get("force") === "true";

    // If route has completed stops and force delete is not specified, return warning
    if (hasCompletedStops && !forceDelete) {
      return NextResponse.json(
        {
          message: "Route has completed stops",
          warning: `This route has ${completedStops.length} completed stops. Deleting it will permanently remove all delivery data.`,
          completedStops: completedStops.length,
          totalStops: route.stops.length,
          requiresConfirmation: true,
        },
        { status: 409 } // Conflict status
      );
    }

    // Perform cascade deletion in a transaction
    const deletionResult = await prisma.$transaction(async (tx) => {
      // Get all stop IDs for this route
      const stopIds = route.stops.map(stop => stop.id);

      // Delete admin notes for all stops
      if (stopIds.length > 0) {
        const deletedAdminNotes = await tx.adminNote.deleteMany({
          where: {
            stopId: {
              in: stopIds,
            },
          },
        });

        // Delete safety checks for this route
        const deletedSafetyChecks = await tx.safetyCheck.deleteMany({
          where: {
            routeId: routeId,
          },
        });

        // Soft delete all stops
        const deletedStops = await tx.stop.updateMany({
          where: {
            routeId: routeId,
            isDeleted: false,
          },
          data: {
            isDeleted: true,
            updatedAt: new Date(),
          },
        });

        // Soft delete the route
        const deletedRoute = await tx.route.update({
          where: { id: routeId },
          data: {
            isDeleted: true,
            updatedAt: new Date(),
          },
        });

        return {
          route: deletedRoute,
          deletedStops: deletedStops.count,
          deletedAdminNotes: deletedAdminNotes.count,
          deletedSafetyChecks: deletedSafetyChecks.count,
        };
      } else {
        // No stops, just delete the route
        const deletedRoute = await tx.route.update({
          where: { id: routeId },
          data: {
            isDeleted: true,
            updatedAt: new Date(),
          },
        });

        return {
          route: deletedRoute,
          deletedStops: 0,
          deletedAdminNotes: 0,
          deletedSafetyChecks: 0,
        };
      }
    });

    // Log the deletion for audit purposes
    if (process.env.NODE_ENV !== "production") {
      console.log(`Route ${route.routeNumber} deleted by admin ${decoded.username}:`, {
        routeId: routeId,
        routeNumber: route.routeNumber,
        deletedStops: deletionResult.deletedStops,
        deletedAdminNotes: deletionResult.deletedAdminNotes,
        deletedSafetyChecks: deletionResult.deletedSafetyChecks,
        deletedBy: decoded.username,
        deletedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      message: "Route deleted successfully",
      routeNumber: route.routeNumber,
      deletedStops: deletionResult.deletedStops,
      deletedAdminNotes: deletionResult.deletedAdminNotes,
      deletedSafetyChecks: deletionResult.deletedSafetyChecks,
    });

  } catch (error) {
    console.error("Error deleting route:", error);
    return NextResponse.json(
      {
        message: `An error occurred while deleting the route: ${
          (error as Error).message
        }`,
      },
      { status: 500 }
    );
  }
}
