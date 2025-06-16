import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Unwrap params
    const unwrappedParams = await Promise.resolve(params);
    const stopId = unwrappedParams.id;

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { driverPaymentAmount, driverPaymentMethods } = await request.json();

    // Validate input
    if (!driverPaymentAmount || driverPaymentAmount <= 0) {
      return NextResponse.json(
        { message: "Payment amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!driverPaymentMethods || !Array.isArray(driverPaymentMethods) || driverPaymentMethods.length === 0) {
      return NextResponse.json(
        { message: "At least one payment method must be selected" },
        { status: 400 }
      );
    }

    // Verify the stop exists and belongs to this driver
    const stop = await prisma.stop.findUnique({
      where: {
        id: stopId,
        isDeleted: false,
      },
      include: {
        route: {
          include: {
            driver: true,
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

    // Check if the driver is assigned to this stop's route or if the stop has the driver's name
    const driverUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!driverUser) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

    // Verify driver has access to this stop
    const hasAccess = 
      stop.route.driverId === decoded.userId || 
      stop.driverNameFromUpload === driverUser.username ||
      stop.driverNameFromUpload === driverUser.fullName;

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You don't have access to this stop" },
        { status: 403 }
      );
    }

    // Update the stop with payment information
    const updatedStop = await prisma.stop.update({
      where: {
        id: stopId,
      },
      data: {
        driverPaymentAmount: driverPaymentAmount,
        driverPaymentMethods: driverPaymentMethods,
      },
      include: {
        customer: true,
        route: {
          include: {
            driver: true,
          },
        },
        adminNotes: {
          include: {
            admin: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return NextResponse.json(updatedStop);
  } catch (error) {
    console.error("Error updating payment information:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
