import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/route-checkin?routeId=... - Check whether the driver has an
// end-of-route closeout (Warehouse/Jetro) check-in assigned for this route,
// and if so, the status of their most recent submission.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const routeId = request.nextUrl.searchParams.get("routeId");

    if (!routeId) {
      return NextResponse.json(
        { message: "routeId is required" },
        { status: 400 }
      );
    }

    const driver = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { username: true, fullName: true },
    });

    if (!driver) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

    const assignment = await prisma.routeCloseoutAssignment.findUnique({
      where: {
        routeId_driverId: {
          routeId,
          driverId: decoded.id,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ required: false });
    }

    const latestCheck = await prisma.routeCloseoutCheck.findFirst({
      where: { routeId, driverId: decoded.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      required: true,
      type: assignment.type,
      latestCheck: latestCheck || null,
      resolved: latestCheck ? latestCheck.pendingPickup === false : false,
    });
  } catch (error) {
    console.error("Error fetching route check-in status:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// POST /api/driver/route-checkin - Submit an end-of-route closeout check-in.
//
// Body: { routeId: string; contactedPerson: string; pendingPickup: boolean; note?: string; photoUrl: string }
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { routeId, contactedPerson, pendingPickup, photoUrl } = data;
    const note = data.note;

    if (
      !routeId ||
      typeof routeId !== "string" ||
      !contactedPerson ||
      typeof contactedPerson !== "string" ||
      !photoUrl ||
      typeof photoUrl !== "string" ||
      typeof pendingPickup !== "boolean"
    ) {
      return NextResponse.json(
        { message: "routeId, contactedPerson, photoUrl and pendingPickup are required" },
        { status: 400 }
      );
    }

    if (pendingPickup === false && (!note || typeof note !== "string" || !note.trim())) {
      return NextResponse.json(
        { message: "A note is required when there is no pending pickup" },
        { status: 400 }
      );
    }

    const assignment = await prisma.routeCloseoutAssignment.findUnique({
      where: {
        routeId_driverId: {
          routeId,
          driverId: decoded.id,
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { message: "No closeout check-in is assigned for this route" },
        { status: 404 }
      );
    }

    const check = await prisma.routeCloseoutCheck.create({
      data: {
        routeId,
        driverId: decoded.id,
        type: assignment.type,
        contactedPerson,
        pendingPickup,
        note: note || null,
        photoUrl,
      },
    });

    return NextResponse.json(check);
  } catch (error) {
    console.error("Error submitting route check-in:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
