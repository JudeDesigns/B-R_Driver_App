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

    if (!decoded || !decoded.id || decoded.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the stop ID from the URL
    const stopId = params.id;

    // Get the stop with customer and return data
    const stop = await prisma.stop.findUnique({
      where: {
        id: stopId,
        isDeleted: false,
      },
      include: {
        customer: true,
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

    // Get the signed invoice URL
    const signedInvoiceUrl = stop.signedInvoiceUrl || "";

    // Get the original invoice URL (this would typically come from QuickBooks or another system)
    // For now, we'll use a placeholder
    const originalInvoiceUrl = stop.invoiceNumber
      ? `https://example.com/invoices/${stop.invoiceNumber}.pdf`
      : "";

    // Get return reasons
    const returnReasons = stop.returns.map((returnItem) => returnItem.reason);

    // Format delivery time
    const deliveryTime = stop.completedAt
      ? new Date(stop.completedAt).toLocaleString()
      : new Date().toLocaleString();

    // Send the email
    const emailResult = await sendDeliveryConfirmationEmail(
      stopId,
      stop.customer.email,
      stop.customer.name,
      stop.orderNumber || "N/A",
      deliveryTime,
      stop.returns.length > 0,
      returnReasons,
      signedInvoiceUrl,
      originalInvoiceUrl
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
