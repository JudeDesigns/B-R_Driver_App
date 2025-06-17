import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { stopId, routeId, customerId, notes, returnItems } = body;

    // Validate required fields
    if (
      !stopId ||
      !routeId ||
      !customerId ||
      !returnItems ||
      !Array.isArray(returnItems) ||
      returnItems.length === 0
    ) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate return items
    for (const item of returnItems) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { message: "Invalid return item data" },
          { status: 400 }
        );
      }
    }

    // Get the driver's information first
    const driver = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
      select: {
        username: true,
        fullName: true,
      },
    });

    if (!driver) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

    const driverName = driver.fullName || driver.username;

    // Check if stop exists and belongs to the driver
    const stop = await prisma.stop.findUnique({
      where: {
        id: stopId,
        isDeleted: false,
      },
      include: {
        route: {
          select: {
            id: true,
            driverId: true,
            status: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found" },
        { status: 404 }
      );
    }

    // Check if the route ID matches
    if (stop.route.id !== routeId) {
      return NextResponse.json(
        { message: "Stop does not belong to the specified route" },
        { status: 400 }
      );
    }

    // Check if the driver is assigned to this specific stop or route
    // Driver can be assigned in two ways:
    // 1. Direct route assignment (route.driverId)
    // 2. Stop-specific assignment (stop.driverNameFromUpload)
    const isDriverAssigned =
      stop.route.driverId === decoded.id ||
      stop.driverNameFromUpload === driverName ||
      stop.driverNameFromUpload === driver.username;

    if (!isDriverAssigned && !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json(
        { message: "You are not authorized to manage returns for this stop" },
        { status: 403 }
      );
    }

    // Create return records for each item (using the actual schema)
    const createdReturns = [];

    for (const item of returnItems) {
      const newReturn = await prisma.return.create({
        data: {
          stopId: stopId,
          orderItemIdentifier: item.productId, // Keep for backward compatibility
          productDescription: `${item.productName || 'Product'} (${item.productCode || 'N/A'})`, // Keep for backward compatibility
          productId: item.productId, // Add this line to use the relation
          quantity: item.quantity,
          reasonCode: item.reason || "Driver return",
          warehouseLocation: null,
          vendorCreditNum: null,
        },
      });
      createdReturns.push(newReturn);
    }

    return NextResponse.json({
      message: "Returns created successfully",
      returns: createdReturns,
      count: createdReturns.length,
    });
  } catch (error) {
    console.error("Error creating return:", error);
    return NextResponse.json(
      { message: "An error occurred while creating the return" },
      { status: 500 }
    );
  }
}
