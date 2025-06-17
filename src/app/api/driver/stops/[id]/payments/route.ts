import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

// GET /api/driver/stops/[id]/payments - Get all payments for a stop
export async function GET(
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
      where: { id: decoded.id },
    });

    if (!driverUser) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

    // Verify driver has access to this stop
    const hasAccess = 
      stop.route.driverId === decoded.id || 
      stop.driverNameFromUpload === driverUser.username ||
      stop.driverNameFromUpload === driverUser.fullName;

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You don't have access to this stop" },
        { status: 403 }
      );
    }

    // Get all payments for this stop
    const payments = await prisma.payment.findMany({
      where: {
        stopId: stopId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/driver/stops/[id]/payments - Delete a specific payment
export async function DELETE(
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

    // Get payment ID from query params
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { message: "Payment ID is required" },
        { status: 400 }
      );
    }

    // Verify the payment exists and belongs to this stop
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        stop: {
          include: {
            route: {
              include: {
                driver: true,
              },
            },
          },
        },
      },
    });

    if (!payment || payment.stopId !== stopId) {
      return NextResponse.json(
        { message: "Payment not found" },
        { status: 404 }
      );
    }

    // Check driver access
    const driverUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!driverUser) {
      return NextResponse.json(
        { message: "Driver not found" },
        { status: 404 }
      );
    }

    const hasAccess = 
      payment.stop.route.driverId === decoded.id || 
      payment.stop.driverNameFromUpload === driverUser.username ||
      payment.stop.driverNameFromUpload === driverUser.fullName;

    if (!hasAccess) {
      return NextResponse.json(
        { message: "You don't have access to this payment" },
        { status: 403 }
      );
    }

    // Delete the payment and update stop totals
    await prisma.$transaction(async (tx) => {
      // Delete the payment
      await tx.payment.delete({
        where: { id: paymentId },
      });

      // Recalculate totals for the stop
      const remainingPayments = await tx.payment.findMany({
        where: { stopId: stopId },
      });

      const totalAmount = remainingPayments.reduce((sum, p) => sum + p.amount, 0);
      const allMethods = [...new Set(remainingPayments.map(p => p.method))];

      // Update stop with new totals
      await tx.stop.update({
        where: { id: stopId },
        data: {
          driverPaymentAmount: totalAmount > 0 ? totalAmount : null,
          driverPaymentMethods: allMethods.length > 0 ? allMethods : [],
          paymentFlagNotPaid: totalAmount === 0, // Set to not paid if no payments remain
        },
      });
    });

    return NextResponse.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
