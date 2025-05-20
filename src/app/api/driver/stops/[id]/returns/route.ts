import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/driver/stops/[id]/returns - Get all returns for a stop
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
    const id = await params.id;

    // Check if the stop exists and belongs to a route assigned to the driver
    const stop = await prisma.stop.findFirst({
      where: {
        id,
        isDeleted: false,
        ...(decoded.role === "DRIVER"
          ? {
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
            }
          : {}),
      },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Get all returns for the stop
    const returns = await prisma.return.findMany({
      where: {
        stopId: id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(returns);
  } catch (error) {
    console.error("Error fetching returns:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// POST /api/driver/stops/[id]/returns - Create a new return for a stop
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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the stop ID from the URL
    const id = await params.id;

    // Check if the stop exists and belongs to a route assigned to the driver
    const stop = await prisma.stop.findFirst({
      where: {
        id,
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
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found or not assigned to you" },
        { status: 404 }
      );
    }

    // Get the return data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.orderItemIdentifier || !data.quantity || !data.reasonCode) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the return
    const newReturn = await prisma.return.create({
      data: {
        stopId: id,
        orderItemIdentifier: data.orderItemIdentifier,
        productDescription: data.productDescription,
        quantity: data.quantity,
        reasonCode: data.reasonCode,
        warehouseLocation: data.warehouseLocation,
        vendorCreditNum: data.vendorCreditNum,
      },
    });

    return NextResponse.json(newReturn);
  } catch (error) {
    console.error("Error creating return:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
