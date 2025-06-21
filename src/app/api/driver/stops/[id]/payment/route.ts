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

    // Parse request body - support both old format and new format
    const body = await request.json();

    // New format: array of payments
    if (body.payments && Array.isArray(body.payments)) {
      // Validate payments array
      if (body.payments.length === 0) {
        return NextResponse.json(
          { message: "At least one payment entry is required" },
          { status: 400 }
        );
      }

      for (const payment of body.payments) {
        if (!payment.amount || payment.amount <= 0) {
          return NextResponse.json(
            { message: "All payment amounts must be greater than 0" },
            { status: 400 }
          );
        }
        if (!payment.method || !["Cash", "Check", "Credit Card"].includes(payment.method)) {
          return NextResponse.json(
            { message: "Invalid payment method. Must be Cash, Check, or Credit Card" },
            { status: 400 }
          );
        }
      }
    }
    // Old format: single payment (for backward compatibility)
    else if (body.driverPaymentAmount && body.driverPaymentMethods) {
      if (!body.driverPaymentAmount || body.driverPaymentAmount <= 0) {
        return NextResponse.json(
          { message: "Payment amount must be greater than 0" },
          { status: 400 }
        );
      }

      if (!body.driverPaymentMethods || !Array.isArray(body.driverPaymentMethods) || body.driverPaymentMethods.length === 0) {
        return NextResponse.json(
          { message: "At least one payment method must be selected" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { message: "Invalid payment data format" },
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

    // Handle payment creation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Handle new format: array of payments
      if (body.payments && Array.isArray(body.payments)) {
        // First, delete existing payment records to avoid duplicates
        await tx.payment.deleteMany({
          where: {
            stopId: stopId,
          },
        });

        // Create individual payment records
        const createdPayments = await Promise.all(
          body.payments.map((payment: any) =>
            tx.payment.create({
              data: {
                stopId: stopId,
                amount: payment.amount,
                method: payment.method,
                notes: payment.notes || null,
              },
            })
          )
        );

        // Calculate total payment amount
        const totalAmount = body.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
        const allMethods = [...new Set(body.payments.map((p: any) => p.method))];

        // Update stop with aggregated payment info and set payment status
        const updatedStop = await tx.stop.update({
          where: { id: stopId },
          data: {
            driverPaymentAmount: totalAmount,
            driverPaymentMethods: allMethods,
            paymentFlagNotPaid: false, // Mark as paid
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
            payments: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });

        return updatedStop;
      }
      // Handle old format: single payment (backward compatibility)
      else {
        // Update stop with legacy format and set payment status
        const updatedStop = await tx.stop.update({
          where: { id: stopId },
          data: {
            driverPaymentAmount: body.driverPaymentAmount,
            driverPaymentMethods: body.driverPaymentMethods,
            paymentFlagNotPaid: false, // Mark as paid
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
            payments: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        });

        return updatedStop;
      }
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating payment information:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
