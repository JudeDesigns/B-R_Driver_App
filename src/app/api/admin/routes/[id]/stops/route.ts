import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// POST /api/admin/routes/[id]/stops - Add a new stop to a route
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: routeId } = await params;

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

    // Get the stop data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.customerNameFromUpload || !data.driverId) {
      return NextResponse.json(
        { message: "Customer name and driver are required" },
        { status: 400 }
      );
    }

    // Check if the route exists
    const existingRoute = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        stops: {
          where: { isDeleted: false },
          orderBy: { sequence: "desc" },
          take: 1,
        },
      },
    });

    if (!existingRoute) {
      return NextResponse.json({ message: "Route not found" }, { status: 404 });
    }

    // Get the driver information
    const driver = await prisma.user.findUnique({
      where: {
        id: data.driverId,
        role: "DRIVER",
        isDeleted: false,
      },
    });

    if (!driver) {
      return NextResponse.json({ message: "Driver not found" }, { status: 404 });
    }

    // Get the next sequence number
    const lastSequence = existingRoute.stops[0]?.sequence || 0;
    const nextSequence = lastSequence + 1;

    // Create a customer record if needed
    let customer = await prisma.customer.findFirst({
      where: {
        name: data.customerNameFromUpload,
        isDeleted: false,
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: data.customerNameFromUpload,
          address: data.address || "",
          contactInfo: data.contactInfo || null,
          preferences: data.preferences || null,
          groupCode: data.groupCode || null,
        },
      });
    }

    // Create the new stop
    const newStop = await prisma.stop.create({
      data: {
        routeId: routeId,
        customerId: customer.id,
        sequence: nextSequence,
        address: data.address || customer.address || "", // Use provided address or customer's address
        customerNameFromUpload: data.customerNameFromUpload,
        driverNameFromUpload: driver.fullName || driver.username,
        orderNumberWeb: data.orderNumberWeb || null,
        quickbooksInvoiceNum: data.quickbooksInvoiceNum || null,
        initialDriverNotes: data.initialDriverNotes || null,
        status: "PENDING",
        isCOD: data.isCOD || false,
        paymentFlagCash: data.paymentFlagCash || false,
        paymentFlagCheck: data.paymentFlagCheck || false,
        paymentFlagCC: data.paymentFlagCC || false,
        paymentFlagNotPaid: data.paymentFlagNotPaid || false,
        returnFlagInitial: data.returnFlagInitial || false,
        driverRemarkInitial: data.driverRemarkInitial || null,
        amount: data.amount || null,
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

    return NextResponse.json({
      message: "Stop added successfully",
      stop: newStop,
    });
  } catch (error) {
    console.error("Error adding stop:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
