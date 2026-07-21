import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// PATCH /api/admin/routes/[id]/reorder-driver-stops - Reorder a subset of a
// route's stops (e.g. one driver's stops) without disturbing other stops'
// relative sequence slots.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params before using its properties (Next.js 15 requirement)
  const { id: routeId } = await params;
  try {
    // Verify authentication
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

    const { stopIds } = await request.json();
    if (!Array.isArray(stopIds) || stopIds.length === 0) {
      return NextResponse.json(
        { message: "stopIds array is required" },
        { status: 400 }
      );
    }

    // Fetch all non-deleted stops for this route in current sequence order
    const allStops = await prisma.stop.findMany({
      where: { routeId, isDeleted: false },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true },
    });

    // Validate all provided stopIds actually belong to this route
    const allStopIds = new Set(allStops.map((s) => s.id));
    if (!stopIds.every((sid: string) => allStopIds.has(sid))) {
      return NextResponse.json(
        { message: "One or more stopIds do not belong to this route" },
        { status: 400 }
      );
    }

    // Find the index positions currently occupied by the given subset, in route order
    const stopIdSet = new Set(stopIds);
    const positions: number[] = [];
    allStops.forEach((s, idx) => {
      if (stopIdSet.has(s.id)) positions.push(idx);
    });

    if (positions.length !== stopIds.length) {
      return NextResponse.json(
        { message: "Mismatch between stopIds and route stops" },
        { status: 400 }
      );
    }

    // Build the new full ordering: same positions, but the subset's stops are
    // replaced in the new order given by the client. Other stops keep their slot.
    const newOrderIds = allStops.map((s) => s.id);
    positions.forEach((pos, i) => {
      newOrderIds[pos] = stopIds[i];
    });

    // Only update rows whose stop id actually changed at that position (assign
    // the ORIGINAL sequence value that occupied that position, so we preserve
    // existing sequence numbering/gaps rather than renumbering everything).
    const updates: { id: string; sequence: number }[] = [];
    newOrderIds.forEach((stopId, idx) => {
      if (stopId !== allStops[idx].id) {
        updates.push({ id: stopId, sequence: allStops[idx].sequence });
      }
    });

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.stop.update({ where: { id: u.id }, data: { sequence: u.sequence } })
        )
      );
    }

    return NextResponse.json({ message: "Stops reordered successfully", updated: updates.length });
  } catch (error) {
    console.error("Error reordering driver stops:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
