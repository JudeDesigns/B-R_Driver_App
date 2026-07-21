import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { StopStatus, Prisma } from "@prisma/client";

// PATCH /api/admin/routes/[id]/reassign-driver - Bulk reassign stops on a
// route from one driver to another in a single action.
//
// Body: { fromDriver: string; toDriverId: string; scope?: "remaining" | "all" }
// - fromDriver: the driverNameFromUpload (or route driver username) whose
//   stops should be moved.
// - scope "remaining" (default): only stops that are still PENDING or
//   ON_THE_WAY are reassigned. COMPLETED/ARRIVED/CANCELLED/FAILED stops keep
//   their original driver so their history, uploaded documents and payments
//   stay attached to the driver who actually handled them.
// - scope "all": reassign every stop on the route currently attributed to
//   fromDriver, regardless of status.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routeId } = await params;

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { fromDriver, toDriverId } = data;
    const scope: "remaining" | "all" = data.scope === "all" ? "all" : "remaining";

    if (!fromDriver || !toDriverId) {
      return NextResponse.json(
        { message: "fromDriver and toDriverId are required" },
        { status: 400 }
      );
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId, isDeleted: false },
      include: { driver: true },
    });

    if (!route) {
      return NextResponse.json({ message: "Route not found" }, { status: 404 });
    }

    const newDriver = await prisma.user.findUnique({
      where: { id: toDriverId, role: "DRIVER", isDeleted: false },
    });

    if (!newDriver) {
      return NextResponse.json({ message: "Driver not found" }, { status: 404 });
    }

    // Stops attributed to fromDriver either via driverNameFromUpload, or via
    // the route's default driver username when driverNameFromUpload is unset.
    const isFromRouteDefaultDriver = fromDriver === route.driver?.username;

    const where: Prisma.StopWhereInput = {
      routeId,
      isDeleted: false,
      OR: [
        { driverNameFromUpload: fromDriver },
        ...(isFromRouteDefaultDriver ? [{ driverNameFromUpload: null }] : []),
      ],
    };

    if (scope === "remaining") {
      where.status = { in: [StopStatus.PENDING, StopStatus.ON_THE_WAY] };
    }

    const updated = await prisma.stop.updateMany({
      where,
      data: {
        driverNameFromUpload: newDriver.username,
      },
    });

    return NextResponse.json({
      message: "Route stops reassigned successfully",
      reassignedCount: updated.count,
      scope,
      newDriver: {
        id: newDriver.id,
        username: newDriver.username,
        fullName: newDriver.fullName,
      },
    });
  } catch (error) {
    console.error("Error reassigning route driver:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
