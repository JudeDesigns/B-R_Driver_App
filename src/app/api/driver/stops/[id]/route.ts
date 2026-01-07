import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sendDeliveryConfirmationEmail } from "@/lib/email";
import { toPSTStartOfDay } from "@/lib/timezone";
import {
  emitStopStatusUpdate,
  emitRouteStatusUpdate,
} from "@/app/api/socketio/route";
import { getPSTDate } from "@/lib/timezone";

// GET /api/driver/stops/[id] - Get a specific stop for the driver
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

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the stop ID from the URL
    const id = await params.id;

    // Get the driver's username for safety check verification
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

    // Get the stop
    const stop = await prisma.stop.findFirst({
      where: {
        id,
        isDeleted: false,
        route: {
          OR: [
            { driverId: decoded.id }, // Ensure the stop belongs to a route assigned to the driver
            {
              stops: {
                some: {
                  OR: [
                    { driverNameFromUpload: driver.username },
                    { driverNameFromUpload: driver.fullName },
                  ],
                },
              },
            },
          ],
          isDeleted: false,
        },
      },
      include: {
        customer: {
          include: {
            documents: {
              where: {
                isActive: true,
                isDeleted: false,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
            status: true,
          },
        },
        adminNotes: {
          where: {
            isDeleted: false,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            admin: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        stopDocuments: {
          where: {
            isDeleted: false,
            document: {
              isActive: true,
              isDeleted: false,
            },
          },
          include: {
            document: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    // Log the stop details for debugging in development only
    if (process.env.NODE_ENV !== "production") {
      console.log("Driver stop details:", {
        id: stop?.id,
        customerName: stop?.customer?.name,
        quickbooksInvoiceNum: stop?.quickbooksInvoiceNum,
        orderNumberWeb: stop?.orderNumberWeb,
      });
    }

    if (!stop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
    }

    // SAFETY CHECK ENFORCEMENT: Check if driver has completed safety check for this route
    const safetyCheck = await prisma.safetyCheck.findFirst({
      where: {
        routeId: stop.routeId,
        driverId: decoded.id,
        type: "START_OF_DAY",
        isDeleted: false,
      },
    });

    if (!safetyCheck) {
      return NextResponse.json(
        {
          message: "Safety check must be completed before accessing stop details",
          requiresSafetyCheck: true,
          routeId: stop.routeId
        },
        { status: 403 }
      );
    }

    // Mark any unread admin notes as read
    const unreadNotes = stop.adminNotes.filter((note) => !note.readByDriver);
    if (unreadNotes.length > 0) {
      await prisma.adminNote.updateMany({
        where: {
          id: {
            in: unreadNotes.map((note) => note.id),
          },
        },
        data: {
          readByDriver: true,
          readByDriverAt: new Date(),
        },
      });
    }

    return NextResponse.json(stop);
  } catch (error) {
    console.error("Error fetching stop:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/driver/stops/[id] - Update a stop (driver can update status, arrival time, etc.)
export async function PATCH(
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

    // Get the driver's username for access verification
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

    // Get the update data from the request body
    const data = await request.json();

    // Validate the data - drivers can only update certain fields
    const allowedFields = [
      "status",
      "arrivalTime",
      "completionTime",
      "driverNotes",
      "signedInvoicePdfUrl",
      "onTheWayTime", // Add field to store when driver started the delivery
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in data) {
        updateData[field] = data[field];
      }
    }

    // Automatically set timestamps based on status changes (using PST timezone)
    const now = getPSTDate();

    // If status is changing to ON_THE_WAY, record the timestamp
    if (data.status === "ON_THE_WAY") {
      updateData.onTheWayTime = now;
    }

    // If status is changing to ARRIVED, record the timestamp
    if (data.status === "ARRIVED") {
      updateData.arrivalTime = now;
    }

    // If status is changing to COMPLETED, record the timestamp
    if (data.status === "COMPLETED") {
      updateData.completionTime = now;
    }

    // Validate status if provided
    if (
      data.status &&
      !["PENDING", "ON_THE_WAY", "ARRIVED", "COMPLETED"].includes(data.status)
    ) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

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
                  OR: [
                    { driverNameFromUpload: driver.username },
                    { driverNameFromUpload: driver.fullName },
                  ],
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

    // SAFETY CHECK ENFORCEMENT: Check if driver has completed safety check for this route
    const safetyCheck = await prisma.safetyCheck.findFirst({
      where: {
        routeId: stop.routeId,
        driverId: decoded.id,
        type: "START_OF_DAY",
        isDeleted: false,
      },
    });

    if (!safetyCheck) {
      return NextResponse.json(
        {
          message: "Safety check must be completed before updating stop details",
          requiresSafetyCheck: true,
          routeId: stop.routeId
        },
        { status: 403 }
      );
    }

    // Update the stop
    const updatedStop = await prisma.stop.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        route: {
          select: {
            id: true,
            routeNumber: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    // Get the signedInvoicePdfUrl separately to ensure we have it for email
    const stopWithPdf = await prisma.stop.findUnique({
      where: { id },
      select: { signedInvoicePdfUrl: true }
    });

    // If status is updated, emit WebSocket event
    if (data.status && data.status !== stop.status) {
      try {
        // Get driver info
        const driver = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { username: true, fullName: true },
        });

        // Emit stop status update event
        emitStopStatusUpdate({
          stopId: updatedStop.id,
          routeId: updatedStop.routeId,
          status: data.status,
          driverId: decoded.id,
          driverName: driver?.fullName || driver?.username || "Unknown Driver",
          customerName: updatedStop.customer.name,
          timestamp: new Date().toISOString(),
        });

        // If status is COMPLETED, send email notification
        if (data.status === "COMPLETED") {
          try {
            // Get the customer email
            const customer = await prisma.customer.findUnique({
              where: { id: updatedStop.customerId },
              select: { email: true, name: true },
            });

            // Send email to office for every completed delivery (customer email not required)
            if (customer) {
              console.log(`📧 Sending automatic delivery confirmation to office for: ${customer.name}`);
              // Get returns for this stop
              const returns = await prisma.return.findMany({
                where: {
                  stopId: updatedStop.id,
                  isDeleted: false,
                },
                select: {
                  id: true,
                  productDescription: true,
                  quantity: true,
                  reasonCode: true,
                },
              });

              // Format delivery time
              const deliveryTime = updatedStop.completionTime
                ? new Date(updatedStop.completionTime).toLocaleString()
                : new Date().toLocaleString();

              // Get return reasons
              const returnReasons = returns.map(
                (returnItem) => returnItem.reasonCode
              );

              // Prepare stop data for PDF generation
              const stopDataForPdf = {
                id: updatedStop.id,
                customerName: customer.name,
                customerAddress: updatedStop.address,
                routeNumber: updatedStop.route.routeNumber,
                arrivalTime: updatedStop.arrivalTime,
                completionTime: updatedStop.completionTime,
                driverNotes: updatedStop.driverNotes,
                adminNotes: null, // Will be populated if needed
                orderNumberWeb: updatedStop.orderNumberWeb,
                quickbooksInvoiceNum: updatedStop.quickbooksInvoiceNum,
                amount: updatedStop.amount || 0, // Add total amount
              };

              // Prepare image URLs for PDF (from invoice images)
              const imageUrls = updatedStop.invoiceImageUrls.map((url: string, index: number) => ({
                url: url,
                name: `Invoice Image ${index + 1}`,
              }));

              // Send the email with PDF attachment (controlled by EMAIL_CONFIG.SEND_TO_CUSTOMERS)
              const sendToCustomer = true; // Let EMAIL_CONFIG.SEND_TO_CUSTOMERS control the behavior

              // Use existing PDF if available, otherwise skip email (PDF should exist from upload)
              if (stopWithPdf?.signedInvoicePdfUrl) {
                console.log(`📄 Using existing PDF for email: ${stopWithPdf.signedInvoicePdfUrl}`);

                const emailResult = await sendDeliveryConfirmationEmail(
                  updatedStop.id,
                  customer.email || '', // Customer email for record keeping (not used for actual sending)
                  customer.name,
                  updatedStop.orderNumberWeb || "N/A",
                  deliveryTime,
                  stopDataForPdf,
                  stopWithPdf.signedInvoicePdfUrl, // Use existing PDF path
                  sendToCustomer
                );

                if (emailResult.success) {
                  console.log(`✅ Automatic delivery confirmation email sent to office for: ${customer.name}`);
                  console.log(`📧 Message ID: ${emailResult.messageId}`);
                } else {
                  console.error(`❌ Failed to send automatic email for ${customer.name}: ${emailResult.error}`);
                }
              } else {
                console.warn(`⚠️ No PDF found for stop ${updatedStop.id}, skipping email notification`);
              }
            } else {
              console.log(
                `❌ Customer not found for stop ${updatedStop.customerId} - cannot send automatic email`
              );
            }
          } catch (emailError) {
            console.error(
              "❌ Error sending automatic delivery confirmation email to office:",
              emailError
            );
            // Continue execution even if email sending fails - don't break stop completion
          }
        }
      } catch (error) {
        console.error("Error emitting WebSocket event:", error);
        // Continue execution even if WebSocket emission fails
      }
    }

    // If the status is updated to ON_THE_WAY, update the route status as well
    if (data.status === "ON_THE_WAY" && stop.status !== "ON_THE_WAY") {
      try {
        // First check if the route exists and get its current status
        const route = await prisma.route.findUnique({
          where: {
            id: stop.routeId,
          },
          select: {
            id: true,
            status: true,
          },
        });

        // Only update if the route exists and is in PENDING status
        if (route && route.status === "PENDING") {
          const updatedRoute = await prisma.route.update({
            where: {
              id: stop.routeId,
            },
            data: {
              status: "IN_PROGRESS",
            },
          });

          // Emit route status update event
          try {
            // Get driver info
            const driver = await prisma.user.findUnique({
              where: { id: decoded.id },
              select: { username: true, fullName: true },
            });

            emitRouteStatusUpdate({
              routeId: updatedRoute.id,
              status: "IN_PROGRESS",
              driverId: decoded.id,
              driverName:
                driver?.fullName || driver?.username || "Unknown Driver",
              timestamp: new Date().toISOString(),
            });
          } catch (error) {
            console.error("Error emitting WebSocket event:", error);
            // Continue execution even if WebSocket emission fails
          }
        } else {
          console.log(
            `Route ${stop.routeId} not found or not in PENDING status. Current status: ${route?.status}`
          );
        }
      } catch (error) {
        console.error("Error updating route status:", error);
        // Continue execution even if route update fails
      }
    }

    // Update KPI data when stop is completed (PST timezone)
    console.log(`[KPI DEBUG] Checking KPI update: data.status=${data.status}, stop.status=${stop.status}`);
    if (data.status === "COMPLETED" && stop.status !== "COMPLETED") {
      console.log(`[KPI DEBUG] Stop is being completed, updating KPI for driver ${decoded.username} (ID: ${decoded.id})`);
      try {
        // Get the route to find the date
        const route = await prisma.route.findUnique({
          where: { id: stop.routeId },
          select: { date: true },
        });

        console.log(`[KPI DEBUG] Route date: ${route?.date}`);

        if (route) {
          // Normalize to PST start of day (the entire system works in PST)
          const routeDate = toPSTStartOfDay(new Date(route.date));
          console.log(`[KPI DEBUG] Normalized route date (PST start of day): ${routeDate.toISOString()}`);
          console.log(`[KPI DEBUG] Route date in PST: ${routeDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}`);

          // Get all stops for this driver on this route (total assigned)
          const allDriverStops = await prisma.stop.findMany({
            where: {
              routeId: stop.routeId,
              isDeleted: false,
              OR: [
                { driverNameFromUpload: decoded.username },
                ...(stop.driverNameFromUpload ? [{ driverNameFromUpload: stop.driverNameFromUpload }] : []),
              ],
            },
            select: {
              status: true,
              amount: true,
            },
          });

          console.log(`[KPI DEBUG] Found ${allDriverStops.length} stops for driver ${decoded.username}`);

          const stopsTotal = allDriverStops.length;
          const completedStops = allDriverStops.filter(s => s.status === "COMPLETED");
          const stopsCompleted = completedStops.length;
          const totalDelivered = completedStops.reduce(
            (sum, s) => sum + (s.amount || 0),
            0
          );

          console.log(`[KPI DEBUG] Stops: ${stopsCompleted}/${stopsTotal} completed, $${totalDelivered} delivered`);

          // Update or create KPI record
          const kpiResult = await prisma.dailyKPI.upsert({
            where: {
              driverId_date: {
                driverId: decoded.id,
                date: routeDate,
              },
            },
            create: {
              driverId: decoded.id,
              routeId: stop.routeId,
              date: routeDate,
              stopsCompleted,
              totalDelivered,
              stopsTotal,
            },
            update: {
              stopsCompleted,
              totalDelivered,
              stopsTotal,
            },
          });

          console.log(`✅ KPI updated for ${decoded.username}: ${stopsCompleted}/${stopsTotal} stops completed, $${totalDelivered} delivered`);
          console.log(`[KPI DEBUG] KPI record ID: ${kpiResult.id}`);
        } else {
          console.error(`[KPI DEBUG] Route not found for stop ${stop.id}`);
        }
      } catch (error) {
        console.error("[KPI DEBUG] Error updating KPI on stop completion:", error);
        // Continue execution even if KPI update fails
      }
    } else {
      console.log(`[KPI DEBUG] Skipping KPI update - condition not met`);
    }

    // If all stops in the route are completed, update the route status to COMPLETED
    if (data.status === "COMPLETED" && stop.status !== "COMPLETED") {
      // Get all stops for this route
      const routeStops = await prisma.stop.findMany({
        where: {
          routeId: stop.routeId,
          isDeleted: false,
        },
        orderBy: {
          sequence: "asc",
        },
      });

      // Count pending stops (excluding the current one)
      const pendingStops = routeStops.filter(
        (s) =>
          s.id !== stop.id &&
          s.status !== "COMPLETED" &&
          s.status !== "CANCELLED"
      ).length;

      if (pendingStops === 0) {
        try {
          // First check if the route exists
          const route = await prisma.route.findUnique({
            where: {
              id: stop.routeId,
            },
            select: {
              id: true,
              status: true,
            },
          });

          if (route) {
            // All stops are completed, update route status
            const updatedRoute = await prisma.route.update({
              where: {
                id: stop.routeId,
              },
              data: {
                status: "COMPLETED",
              },
            });

            // Emit route status update event
            try {
              // Get driver info
              const driver = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { username: true, fullName: true },
              });

              emitRouteStatusUpdate({
                routeId: updatedRoute.id,
                status: "COMPLETED",
                driverId: decoded.id,
                driverName:
                  driver?.fullName || driver?.username || "Unknown Driver",
                timestamp: new Date().toISOString(),
              });
            } catch (error) {
              console.error("Error emitting WebSocket event:", error);
              // Continue execution even if WebSocket emission fails
            }
          } else {
            console.log(
              `Route ${stop.routeId} not found when trying to mark as completed`
            );
          }
        } catch (error) {
          console.error("Error updating route status to completed:", error);
          // Continue execution even if route update fails
        }
      }

      // Auto-start next stop feature (Re-enabled with Auto-Status Update)
      // Find the next pending stop in the sequence that belongs to THIS driver
      const nextStop = routeStops.find(
        (s) =>
          s.sequence > stop.sequence &&
          s.status !== "COMPLETED" &&
          s.status !== "CANCELLED" &&
          // IMPORTANT: Only auto-start stops assigned to the current driver
          (s.driverNameFromUpload === driver.username ||
           s.driverNameFromUpload === driver.fullName)
      );

      if (nextStop) {
        try {
          // Update the next stop status to ON_THE_WAY
          // Uses PST time for consistency
          const now = getPSTDate();

          await prisma.stop.update({
            where: { id: nextStop.id },
            data: {
              status: "ON_THE_WAY",
              onTheWayTime: now,
            },
          });

          // Emit WebSocket event for the next stop status update
          try {
            // Get driver info
            const driver = await prisma.user.findUnique({
              where: { id: decoded.id },
              select: { username: true, fullName: true },
            });

            // To get customerName, we need to fetch the next stop with its customer relation
            const nextStopWithCustomer = await prisma.stop.findUnique({
              where: { id: nextStop.id },
              select: {
                customer: {
                  select: { name: true }
                },
                routeId: true, // Ensure routeId is available for the event
              },
            });

            emitStopStatusUpdate({
              stopId: nextStop.id,
              routeId: nextStopWithCustomer?.routeId || nextStop.routeId, // Use fetched routeId if available, fallback to original
              status: "ON_THE_WAY",
              driverId: decoded.id,
              driverName: driver?.fullName || driver?.username || "Unknown Driver",
              customerName: nextStopWithCustomer?.customer?.name || "Unknown Customer",
              timestamp: new Date().toISOString(),
            });
          } catch (wsError) {
            console.error("Error emitting WS event for next stop:", wsError);
          }

          return NextResponse.json({
            ...updatedStop,
            nextStopId: nextStop.id,
          });

        } catch (autoStartError) {
          console.error("Error auto-starting next stop:", autoStartError);
          // If auto-start fails, still return the updated current stop, just without the nextStopId
        }
      }
    }

    return NextResponse.json(updatedStop);
  } catch (error) {
    console.error("Error updating stop:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
