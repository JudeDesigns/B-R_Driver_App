import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/stops/[id] - Get stop details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication first
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

    // Await params before using its properties (Next.js 15 requirement)
    const { id } = await params;

    // Get the stop with all related data
    const stop = await prisma.stop.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        customer: {
          include: {
            documents: {
              where: {
                isDeleted: false,
                isActive: true,
              },
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                fileName: true,
                filePath: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
                uploader: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
        stopDocuments: {
          where: {
            isDeleted: false,
            document: {
              isDeleted: false,
              isActive: true,
            },
          },
          include: {
            document: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                fileName: true,
                filePath: true,
                fileSize: true,
                mimeType: true,
                createdAt: true,
                uploader: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            status: true,
            driver: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        adminNotes: {
          where: {
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
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Log the stop details for debugging in development only
    if (process.env.NODE_ENV !== "production") {
      console.log("Admin stop details:", {
        id: stop.id,
        customerName: stop.customer.name,
        quickbooksInvoiceNum: stop.quickbooksInvoiceNum,
        orderNumberWeb: stop.orderNumberWeb,
      });
    }

    return NextResponse.json(stop);
  } catch (error) {
    console.error("Error fetching stop:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PUT /api/admin/stops/[id] - Update stop details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params before using its properties (Next.js 15 requirement)
  const { id } = await params;
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



    // Get the update data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data) {
      return NextResponse.json(
        { message: "No data provided" },
        { status: 400 }
      );
    }

    // Check if the stop exists
    const existingStop = await prisma.stop.findUnique({
      where: {
        id,
        isDeleted: false,
      },
      select: {
        id: true,
        sequence: true,
        routeId: true,
      },
    });

    if (!existingStop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Handle sequence conflicts if sequence is being changed
    if (data.sequence !== undefined && data.sequence !== existingStop.sequence) {
      const oldSequence = existingStop.sequence;
      const newSequence = data.sequence;

      // Get all stops in the same route (excluding the current stop)
      const routeStops = await prisma.stop.findMany({
        where: {
          routeId: existingStop.routeId,
          isDeleted: false,
          id: { not: id }
        },
        orderBy: { sequence: 'asc' }
      });

      // Determine which stops need to be shifted
      const stopsToUpdate: { id: string; newSequence: number }[] = [];

      if (newSequence < oldSequence) {
        // Moving up (e.g., from sequence 5 to 2)
        // Shift down all stops with sequence >= newSequence and < oldSequence
        routeStops.forEach(stop => {
          if (stop.sequence >= newSequence && stop.sequence < oldSequence) {
            stopsToUpdate.push({
              id: stop.id,
              newSequence: stop.sequence + 1
            });
          }
        });
      } else if (newSequence > oldSequence) {
        // Moving down (e.g., from sequence 2 to 5)
        // Shift up all stops with sequence > oldSequence and <= newSequence
        routeStops.forEach(stop => {
          if (stop.sequence > oldSequence && stop.sequence <= newSequence) {
            stopsToUpdate.push({
              id: stop.id,
              newSequence: stop.sequence - 1
            });
          }
        });
      }

      // Update all affected stops in a transaction
      if (stopsToUpdate.length > 0) {
        await prisma.$transaction(
          stopsToUpdate.map(update =>
            prisma.stop.update({
              where: { id: update.id },
              data: { sequence: update.newSequence }
            })
          )
        );
      }
    }

    // Update the stop
    const updatedStop = await prisma.stop.update({
      where: {
        id,
      },
      data: {
        sequence: data.sequence !== undefined ? data.sequence : undefined,
        status: data.status || undefined,
        customerNameFromUpload: data.customerNameFromUpload || undefined,
        driverNameFromUpload: data.driverNameFromUpload || undefined,
        orderNumberWeb:
          data.orderNumberWeb !== undefined ? data.orderNumberWeb : undefined,
        quickbooksInvoiceNum:
          data.quickbooksInvoiceNum !== undefined
            ? data.quickbooksInvoiceNum
            : undefined,
        initialDriverNotes: data.initialDriverNotes || undefined,
        isCOD: data.isCOD !== undefined ? data.isCOD : undefined,
        paymentFlagCash:
          data.paymentFlagCash !== undefined ? data.paymentFlagCash : undefined,
        paymentFlagCheck:
          data.paymentFlagCheck !== undefined
            ? data.paymentFlagCheck
            : undefined,
        paymentFlagCC:
          data.paymentFlagCC !== undefined ? data.paymentFlagCC : undefined,
        paymentFlagNotPaid:
          data.paymentFlagNotPaid !== undefined
            ? data.paymentFlagNotPaid
            : undefined,
        returnFlagInitial:
          data.returnFlagInitial !== undefined
            ? data.returnFlagInitial
            : undefined,
        driverRemarkInitial: data.driverRemarkInitial || undefined,
        amount: data.amount !== undefined ? data.amount : undefined,
        paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : undefined,
        paymentTermsOther: data.paymentTermsOther !== undefined ? data.paymentTermsOther : undefined,
      },
      include: {
        customer: true,
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(updatedStop);
  } catch (error) {
    console.error("Error updating stop:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// POST /api/admin/stops/[id]/notes - Add admin note to stop
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params before using its properties (Next.js 15 requirement)
  const { id } = await params;
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
    const existingStop = await prisma.stop.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingStop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // Check if the admin user exists
    const adminUser = await prisma.user.findUnique({
      where: {
        id: decoded.id,
        isDeleted: false,
      },
    });

    if (!adminUser) {
      return NextResponse.json(
        { message: "Admin user not found" },
        { status: 404 }
      );
    }

    // Create the admin note
    const adminNote = await prisma.adminNote.create({
      data: {
        note: data.note,
        adminId: decoded.id,
        stopId: id,
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

    return NextResponse.json(adminNote);
  } catch (error) {
    console.error("Error adding admin note:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/stops/[id]/notes/[noteId] - Update an admin note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  // Await params before using its properties (Next.js 15 requirement)
  const { id: stopId, noteId } = await params;
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



    // Get the note data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.note) {
      return NextResponse.json(
        { message: "Note content is required" },
        { status: 400 }
      );
    }

    // Check if the note exists and belongs to the stop
    const existingNote = await prisma.adminNote.findFirst({
      where: {
        id: noteId,
        stopId: stopId,
        isDeleted: false,
      },
    });

    if (!existingNote) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }

    // Update the admin note
    const updatedNote = await prisma.adminNote.update({
      where: {
        id: noteId,
      },
      data: {
        note: data.note,
        updatedAt: new Date(),
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
