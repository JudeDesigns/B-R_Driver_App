import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { emitAdminNoteCreated } from "@/app/api/socketio/route";

// POST /api/admin/stops/[id]/notes - Create a new admin note for a stop
export async function POST(
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the stop ID from the URL
    const { id } = await params;

    // Get the note data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.note) {
      return NextResponse.json(
        { message: "Note content is required" },
        { status: 400 }
      );
    }

    // Check if the stop exists
    const stop = await prisma.stop.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        route: {
          select: {
            id: true,
            driverId: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Find the admin user
    const adminUser = await prisma.user.findUnique({
      where: {
        id: decoded.id,
        isDeleted: false,
      },
    });

    if (!adminUser) {
      return NextResponse.json(
        { message: "Admin user not found in database" },
        { status: 404 }
      );
    }

    // Create the admin note
    const adminNote = await prisma.adminNote.create({
      data: {
        note: data.note,
        adminId: adminUser.id, // Use the verified admin ID
        stopId: id,
        readByDriver: false,
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        stop: {
          select: {
            id: true,
            routeId: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Get the driver ID from the route
    let driverId = stop.route.driverId;

    // If no driver ID is assigned to the route, try to find the driver from the stop's driverNameFromUpload
    if (!driverId) {
      // Get the driver name from the stop
      const stopWithDriver = await prisma.stop.findUnique({
        where: { id },
        select: { driverNameFromUpload: true },
      });

      if (stopWithDriver?.driverNameFromUpload) {
        // Find the driver by username
        const driver = await prisma.user.findFirst({
          where: {
            username: stopWithDriver.driverNameFromUpload,
            role: "DRIVER",
            isDeleted: false,
          },
          select: { id: true },
        });

        if (driver) {
          driverId = driver.id;
        }
      }
    }

    // Emit WebSocket event if we have a driver ID
    if (driverId) {
      try {
        emitAdminNoteCreated({
          noteId: adminNote.id,
          stopId: adminNote.stopId,
          routeId: adminNote.stop.routeId,
          driverId: driverId,
          adminId: adminNote.adminId,
          adminName: adminNote.admin.fullName || adminNote.admin.username,
          note: adminNote.note,
          timestamp: adminNote.createdAt.toISOString(),
        });
      } catch (error) {
        console.error("Error emitting WebSocket event:", error);
        // Continue execution even if WebSocket emission fails
      }
    }

    return NextResponse.json({
      message: "Note created successfully",
      note: adminNote,
    });
  } catch (error) {
    console.error("Error creating admin note:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// GET /api/admin/stops/[id]/notes - Get all admin notes for a stop
export async function GET(
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN", "DRIVER"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the stop ID from the URL
    const { id } = await params;

    // Get all notes for the stop
    const notes = await prisma.adminNote.findMany({
      where: {
        stopId: id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error("Error fetching admin notes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
