import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sendDeliveryConfirmationEmail } from "@/lib/email";

// POST /api/admin/routes/[id]/send-emails - Send delivery confirmation emails for all completed stops in a route
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

    // Get the route ID from the URL
    const routeId = params.id;

    console.log(`📧 Starting bulk email send for route: ${routeId}`);

    // Get the route with all completed stops
    const route = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        stops: {
          where: {
            status: "COMPLETED",
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
        },
      },
    });

    if (!route) {
      return NextResponse.json(
        { message: "Route not found" },
        { status: 404 }
      );
    }

    const completedStops = route.stops;
    console.log(`📧 Found ${completedStops.length} completed stops in route ${route.routeNumber || routeId}`);

    if (completedStops.length === 0) {
      return NextResponse.json(
        { 
          message: "No completed stops found in this route",
          route: route.routeNumber || routeId,
          completedStops: 0
        },
        { status: 200 }
      );
    }

    // Track email sending results
    const emailResults = {
      total: completedStops.length,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    // Send emails for each completed stop
    for (const stop of completedStops) {
      try {
        console.log(`📧 Processing stop ${stop.sequence}: ${stop.customer.name}`);

        // Format delivery time
        const deliveryTime = stop.completionTime
          ? new Date(stop.completionTime).toLocaleString()
          : new Date().toLocaleString();

        // Prepare stop data for PDF generation
        const stopDataForPdf = {
          id: stop.id,
          customerName: stop.customer.name,
          customerAddress: stop.address,
          routeNumber: route.routeNumber || 'N/A',
          arrivalTime: stop.arrivalTime,
          completionTime: stop.completionTime,
          driverNotes: stop.driverNotes,
          adminNotes: null,
          orderNumberWeb: stop.orderNumberWeb,
          quickbooksInvoiceNum: stop.quickbooksInvoiceNum,
          amount: stop.amount || 0, // Add total amount
        };

        // Prepare image URLs for PDF (from invoice images)
        const imageUrls = (stop.invoiceImageUrls || []).map((url: string, index: number) => ({
          url: url,
          name: `Invoice Image ${index + 1}`,
        }));

        // Send the email (to office by default)
        const sendToCustomer = false;

        // Skip stops without PDF
        if (!stop.signedInvoicePdfUrl) {
          console.warn(`⚠️ Skipping stop ${stop.id} - no PDF available`);
          emailResults.skipped++;
          emailResults.details.push({
            stopId: stop.id,
            customer: stop.customer.name,
            orderNumber: stop.orderNumberWeb || "N/A",
            status: 'skipped',
            reason: 'No PDF available'
          });
          continue;
        }

        const emailResult = await sendDeliveryConfirmationEmail(
          stop.id,
          stop.customer.email || '',
          stop.customer.name,
          stop.orderNumberWeb || "N/A",
          deliveryTime,
          stopDataForPdf,
          stop.signedInvoicePdfUrl, // Use existing PDF path
          sendToCustomer
        );

        if (emailResult.success) {
          emailResults.sent++;
          emailResults.details.push({
            stopId: stop.id,
            customer: stop.customer.name,
            orderNumber: stop.orderNumberWeb || "N/A",
            status: "sent",
            messageId: emailResult.messageId
          });
          console.log(`✅ Email sent successfully for stop ${stop.sequence}: ${stop.customer.name}`);
        } else {
          emailResults.failed++;
          const errorMsg = `Stop ${stop.sequence} (${stop.customer.name}): ${emailResult.error}`;
          emailResults.errors.push(errorMsg);
          emailResults.details.push({
            stopId: stop.id,
            customer: stop.customer.name,
            orderNumber: stop.orderNumberWeb || "N/A",
            status: "failed",
            error: emailResult.error
          });
          console.error(`❌ Email failed for stop ${stop.sequence}: ${stop.customer.name} - ${emailResult.error}`);
        }

      } catch (stopError) {
        emailResults.failed++;
        const errorMsg = `Stop ${stop.sequence} (${stop.customer.name}): ${stopError instanceof Error ? stopError.message : 'Unknown error'}`;
        emailResults.errors.push(errorMsg);
        emailResults.details.push({
          stopId: stop.id,
          customer: stop.customer.name,
          orderNumber: stop.orderNumberWeb || "N/A",
          status: "failed",
          error: stopError instanceof Error ? stopError.message : 'Unknown error'
        });
        console.error(`❌ Error processing stop ${stop.sequence}:`, stopError);
      }
    }

    console.log(`📧 Bulk email send completed for route ${route.routeNumber || routeId}:`);
    console.log(`   Total stops: ${emailResults.total}`);
    console.log(`   Sent: ${emailResults.sent}`);
    console.log(`   Failed: ${emailResults.failed}`);

    // Return comprehensive results with proper JSON headers
    const responseData = {
      success: true,
      message: `Email sending completed for route ${route.routeNumber || routeId}`,
      route: {
        id: route.id,
        routeNumber: route.routeNumber,
      },
      results: emailResults,
      summary: `${emailResults.sent}/${emailResults.total} emails sent successfully`
    };

    console.log("📧 Returning success response:", JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error("❌ Error in bulk email API:", error);

    // Ensure we always return JSON
    try {
      return NextResponse.json(
        {
          message: "Failed to send emails",
          error: error instanceof Error ? error.message : "Unknown error",
          route: { id: routeId },
          results: {
            total: 0,
            sent: 0,
            failed: 0,
            errors: [error instanceof Error ? error.message : "Unknown error"],
            details: []
          }
        },
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    } catch (jsonError) {
      console.error("❌ Error creating JSON response:", jsonError);
      // Fallback to basic response
      return new Response(
        JSON.stringify({
          message: "Internal server error",
          error: "Failed to process request"
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
  }
}
