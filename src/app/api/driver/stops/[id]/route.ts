import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  emitStopStatusUpdate,
  emitRouteStatusUpdate,
} from "@/app/api/socketio/route";

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
                  driverNameFromUpload: {
                    equals: decoded.username,
                  },
                },
              },
            },
          ],
          isDeleted: false,
        },
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
      },
    });

    // Log the stop details for debugging
    console.log("Driver stop details:", {
      id: stop?.id,
      customerName: stop?.customer?.name,
      quickbooksInvoiceNum: stop?.quickbooksInvoiceNum,
      orderNumberWeb: stop?.orderNumberWeb,
    });

    if (!stop) {
      return NextResponse.json({ message: "Stop not found" }, { status: 404 });
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

    // Automatically set timestamps based on status changes
    const now = new Date();

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
                  driverNameFromUpload: {
                    equals: decoded.username,
                  },
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
      },
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
      } else {
        // Find the current stop's index
        const currentStopIndex = routeStops.findIndex((s) => s.id === id);

        // Find the next stop that's PENDING
        const nextPendingStop = routeStops.find(
          (s, index) => index > currentStopIndex && s.status === "PENDING"
        );

        // If there's a next pending stop, update it to ON_THE_WAY
        if (nextPendingStop) {
          try {
            // First check if the stop still exists and is still PENDING
            const checkStop = await prisma.stop.findUnique({
              where: {
                id: nextPendingStop.id,
              },
              select: {
                id: true,
                status: true,
              },
            });

            if (checkStop && checkStop.status === "PENDING") {
              const updatedNextStop = await prisma.stop.update({
                where: {
                  id: nextPendingStop.id,
                },
                data: {
                  status: "ON_THE_WAY",
                },
                include: {
                  customer: {
                    select: {
                      name: true,
                    },
                  },
                },
              });

              // Emit stop status update event for the next stop
              const driver = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { username: true, fullName: true },
              });

              emitStopStatusUpdate({
                stopId: updatedNextStop.id,
                routeId: stop.routeId,
                status: "ON_THE_WAY",
                driverId: decoded.id,
                driverName:
                  driver?.fullName || driver?.username || "Unknown Driver",
                customerName: updatedNextStop.customer.name,
                timestamp: new Date().toISOString(),
              });

              console.log(
                `Automatically updated next stop ${updatedNextStop.id} to ON_THE_WAY`
              );
            } else {
              console.log(
                `Next stop ${nextPendingStop.id} not found or not in PENDING status. Current status: ${checkStop?.status}`
              );
            }
          } catch (error) {
            console.error("Error updating next stop:", error);
            // Continue execution even if next stop update fails
          }
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
