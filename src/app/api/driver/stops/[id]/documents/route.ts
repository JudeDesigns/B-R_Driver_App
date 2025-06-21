import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const stopId = params.id;

    // Get the stop with customer information
    const stop = await prisma.stop.findFirst({
      where: {
        id: stopId,
        isDeleted: false,
        route: {
          OR: [
            { driverId: decoded.id },
            {
              stops: {
                some: {
                  driverNameFromUpload: {
                    equals: decoded.username,
                  },
                },
              },
            },
          ],
          isDeleted: false,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        route: {
          select: {
            routeNumber: true,
            date: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Get customer-level documents (automatically available for all stops for this customer)
    const customerDocuments = await prisma.document.findMany({
      where: {
        customerId: stop.customer.id,
        isActive: true,
        isDeleted: false,
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get stop-specific documents (automatically assigned during upload)
    const stopSpecificDocuments = await prisma.stopDocument.findMany({
      where: {
        stopId,
        isDeleted: false,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format the response
    const response = {
      stop: {
        id: stop.id,
        sequence: stop.sequence,
        customerName: stop.customerNameFromUpload,
        route: stop.route,
      },
      documents: {
        customer: customerDocuments.map(doc => ({
          ...doc,
          source: 'customer',
          sourceLabel: `Customer: ${stop.customer.name}`,
        })),
        stop: stopSpecificDocuments.map(stopDoc => ({
          ...stopDoc.document,
          source: 'stop',
          sourceLabel: `Stop ${stop.sequence}`,
          assignedAt: stopDoc.createdAt,
        })),
      },
      totalDocuments: customerDocuments.length + stopSpecificDocuments.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching stop documents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
