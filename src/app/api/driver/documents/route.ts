import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const stopId = searchParams.get("stopId");

    if (stopId) {
      // Get documents for a specific stop
      const stopDocuments = await prisma.stopDocument.findMany({
        where: {
          stopId,
          isDeleted: false,
          document: {
            isActive: true,
            isDeleted: false,
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
            },
          },
          stop: {
            select: {
              id: true,
              sequence: true,
              customerNameFromUpload: true,
              route: {
                select: {
                  id: true,
                  routeNumber: true,
                  date: true,
                },
              },
            },
          },
        },
        orderBy: {
          document: {
            type: "asc",
          },
        },
      });

      return NextResponse.json(stopDocuments);
    } else {
      // Get all documents for driver's assigned stops
      const driverStops = await prisma.stop.findMany({
        where: {
          driverNameFromUpload: decoded.username, // Assuming driver name matches username
          isDeleted: false,
          route: {
            isDeleted: false,
            status: {
              in: ["PENDING", "IN_PROGRESS"],
            },
          },
        },
        include: {
          stopDocuments: {
            where: {
              isDeleted: false,
              document: {
                isActive: true,
                isDeleted: false,
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
                },
              },
            },
          },
          route: {
            select: {
              id: true,
              routeNumber: true,
              date: true,
            },
          },
        },
        orderBy: [
          {
            route: {
              date: "desc",
            },
          },
          {
            sequence: "asc",
          },
        ],
      });

      return NextResponse.json(driverStops);
    }
  } catch (error) {
    console.error("Error fetching driver documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stopDocumentId } = body;

    if (!stopDocumentId) {
      return NextResponse.json(
        { message: "Stop document ID is required" },
        { status: 400 }
      );
    }

    // Mark document as printed
    const stopDocument = await prisma.stopDocument.update({
      where: {
        id: stopDocumentId,
      },
      data: {
        isPrinted: true,
        printedAt: new Date(),
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        stop: {
          select: {
            id: true,
            sequence: true,
            customerNameFromUpload: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Document marked as printed",
      stopDocument,
    });
  } catch (error) {
    console.error("Error marking document as printed:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
