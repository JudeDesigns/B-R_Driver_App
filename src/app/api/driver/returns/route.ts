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

    // Check if stop exists and belongs to the driver
    const stop = await prisma.stop.findUnique({
      where: {
        id: stopId,
        route: {
          id: routeId,
        },
      },
      include: {
        route: {
          include: {
            drivers: true,
          },
        },
      },
    });

    if (!stop) {
      return NextResponse.json(
        { message: "Stop not found or does not belong to the specified route" },
        { status: 404 }
      );
    }

    // Check if the driver is assigned to the route
    const isDriverAssigned = stop.route.drivers.some(
      (driver) => driver.id === decoded.id
    );

    if (!isDriverAssigned && decoded.role !== "ADMIN") {
      return NextResponse.json(
        { message: "You are not authorized to manage returns for this stop" },
        { status: 403 }
      );
    }

    // Create a new return record
    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

    const newReturn = await prisma.return.create({
      data: {
        returnNumber,
        returnDate: new Date(),
        notes,
        status: "PENDING",
        order: {
          connect: { id: stopId }, // Using stopId as orderId for now
        },
        returnItems: {
          create: returnItems.map((item) => ({
            quantity: item.quantity,
            reason: item.reason || null,
            condition: "GOOD", // Default condition
            notes: null, // No notes needed
            product: {
              connect: { id: item.productId },
            },
          })),
        },
      },
      include: {
        returnItems: {
          include: {
            product: true,
          },
        },
      },
    });

    // Update the stop status to include return information
    await prisma.stop.update({
      where: { id: stopId },
      data: {
        hasReturns: true,
        returnNotes: notes || "Return submitted",
      },
    });

    return NextResponse.json({
      message: "Return created successfully",
      return: newReturn,
    });
  } catch (error) {
    console.error("Error creating return:", error);
    return NextResponse.json(
      { message: "An error occurred while creating the return" },
      { status: 500 }
    );
  }
}
