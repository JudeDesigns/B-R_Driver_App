import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  try {
    // Verify admin token
    const token = req.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { message: "Unauthorized: No token provided" },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== "SUPER_ADMIN") {
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
