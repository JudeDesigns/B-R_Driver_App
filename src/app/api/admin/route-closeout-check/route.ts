import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/route-closeout-check?routeId=...&driverId=... - Look up a
// driver's Warehouse/Jetro closeout assignment (if any) for a route, plus
// their latest submitted check-in (if any). Used by the admin End-of-Day
// safety check details modal to show closeout status alongside the rest of
// the submission.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const routeId = searchParams.get("routeId");
    const driverId = searchParams.get("driverId");

    if (!routeId || !driverId) {
      return NextResponse.json(
        { message: "routeId and driverId are required" },
        { status: 400 }
      );
    }

    const assignment = await prisma.routeCloseoutAssignment.findUnique({
      where: { routeId_driverId: { routeId, driverId } },
    });

    if (!assignment) {
      return NextResponse.json({ assigned: false });
    }

    const latestCheck = await prisma.routeCloseoutCheck.findFirst({
      where: { routeId, driverId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      assigned: true,
      type: assignment.type,
      latestCheck,
      resolved: latestCheck ? latestCheck.pendingPickup === false : false,
    });
  } catch (error) {
    console.error("Error fetching route closeout check:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
