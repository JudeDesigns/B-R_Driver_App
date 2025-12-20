import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  verifyPasswordConfirmation,
  createPasswordConfirmationErrorResponse,
} from "@/lib/passwordConfirmation";

export async function DELETE(req: NextRequest) {
  try {
    // Verify password confirmation (includes authentication check)
    const passwordCheck = await verifyPasswordConfirmation(req);

    if (!passwordCheck.confirmed) {
      return createPasswordConfirmationErrorResponse(passwordCheck);
    }

    const decoded = {
      id: passwordCheck.userId,
      role: passwordCheck.userRole,
    };

    if (decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Unauthorized: Super Admin access required for this operation" },
        { status: 403 }
      );
    }

    // Delete all related data in the correct order (due to foreign key constraints)
    
    // First, delete all returns
    const deletedReturns = await prisma.return.deleteMany({});
    
    // Delete all admin notes
    const deletedAdminNotes = await prisma.adminNote.deleteMany({});
    
    // Delete all stops
    const deletedStops = await prisma.stop.deleteMany({});
    
    // Delete all safety checks
    const deletedSafetyChecks = await prisma.safetyCheck.deleteMany({});
    
    // Delete all routes
    const deletedRoutes = await prisma.route.deleteMany({});
    
    // Delete all route uploads
    const deletedRouteUploads = await prisma.routeUpload.deleteMany({});

    return NextResponse.json({
      message: "All route data deleted successfully",
      deletedCounts: {
        returns: deletedReturns.count,
        adminNotes: deletedAdminNotes.count,
        stops: deletedStops.count,
        safetyChecks: deletedSafetyChecks.count,
        routes: deletedRoutes.count,
        routeUploads: deletedRouteUploads.count,
      },
    });
  } catch (error) {
    console.error("Error deleting route data:", error);
    return NextResponse.json(
      { message: "Error deleting route data", error: String(error) },
      { status: 500 }
    );
  }
}
