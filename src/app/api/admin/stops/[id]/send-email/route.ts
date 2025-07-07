import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sendDeliveryConfirmationEmail } from "@/lib/email";

// POST /api/admin/stops/[id]/send-email - Send delivery confirmation email
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the stop ID from the URL
    const stopId = params.id;

    // Get the stop with customer, route, and return data
    const stop = await prisma.stop.findUnique({
      where: {
        id: stopId,
        isDeleted: false,
      },
      include: {
        customer: true,
        route: {
          select: {
            id: true,
            routeNumber: true,
          },
        },
        returns: {
          where: {
            isDeleted: false,
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

    // Check if the stop has a completed status
    if (stop.status !== "COMPLETED") {
      return NextResponse.json(
        { message: "Cannot send email for a stop that is not completed" },
        { status: 400 }
      );
    }

    // Check if the customer has an email
    if (!stop.customer.email) {
      return NextResponse.json(
        { message: "Customer does not have an email address" },
        { status: 400 }
      );
    }

    // Get return reasons
    const returnReasons = stop.returns.map((returnItem) => returnItem.reasonCode);

    // Format delivery time
    const deliveryTime = stop.completionTime
      ? new Date(stop.completionTime).toLocaleString()
      : new Date().toLocaleString();

    // Prepare stop data for PDF generation
    const stopDataForPdf = {
      id: stop.id,
      customerName: stop.customer.name,
      customerAddress: stop.address,
      routeNumber: stop.route?.routeNumber || 'N/A',
      arrivalTime: stop.arrivalTime,
      completionTime: stop.completionTime,
      driverNotes: stop.driverNotes,
      adminNotes: null, // Will be populated if needed
    };

    // Prepare image URLs for PDF (from invoice images)
    const imageUrls = (stop.invoiceImageUrls || []).map((url: string, index: number) => ({
      url: url,
      name: `Invoice Image ${index + 1}`,
    }));

    // Send the email with PDF attachment (to office by default, can be changed to customer)
    const sendToCustomer = false; // Set to true when you want to send to customers
    const emailResult = await sendDeliveryConfirmationEmail(
      stopId,
      stop.customer.email,
      stop.customer.name,
      stop.orderNumberWeb || "N/A",
      deliveryTime,
      stopDataForPdf,
      imageUrls,
      stop.returns,
      sendToCustomer
    );

    if (!emailResult.success) {
      return NextResponse.json(
        { message: `Failed to send email: ${emailResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Email sent successfully",
      messageId: emailResult.messageId,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
