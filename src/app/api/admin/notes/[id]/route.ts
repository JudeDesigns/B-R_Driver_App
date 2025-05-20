import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/notes/[id] - Get admin note details
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
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the note ID from the URL
    const { id } = await params;

    // Get the admin note with related data
    const note = await prisma.adminNote.findUnique({
      where: {
        id,
        isDeleted: false,
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
            sequence: true,
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!note) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error("Error fetching admin note:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/notes/[id] - Update admin note
export async function PATCH(
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

    // Get the note ID from the URL
    const { id } = await params;

    // Get the update data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.note) {
      return NextResponse.json(
        { message: "Note content is required" },
        { status: 400 }
      );
    }

    // Check if the note exists
    const existingNote = await prisma.adminNote.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }

    // Update the admin note
    const updatedNote = await prisma.adminNote.update({
      where: {
        id,
      },
      data: {
        note: data.note,
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

    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error("Error updating admin note:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/notes/[id] - Delete admin note
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the note ID from the URL
    const { id } = await params;

    // Check if the note exists
    const existingNote = await prisma.adminNote.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }

    // Soft delete the admin note
    await prisma.adminNote.update({
      where: {
        id,
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin note:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
