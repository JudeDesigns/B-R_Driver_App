import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// POST /api/driver/safety-check - Submit a safety check
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { routeId, type, details } = body;

    if (!routeId || !type) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if the route exists and the driver has access to it
    const route = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        stops: {
          where: {
            isDeleted: false,
          },
          select: {
            driverNameFromUpload: true,
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ message: "Route not found" }, { status: 404 });
    }

    // Get the driver's username
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

    const driverName = driver.fullName || driver.username;

    // Check if the driver is assigned to this route
    const isDriverAssigned =
      route.driverId === decoded.id ||
      route.stops.some((stop) => stop.driverNameFromUpload === driverName);

    if (!isDriverAssigned) {
      return NextResponse.json(
        { message: "You are not assigned to this route" },
        { status: 403 }
      );
    }

    // Check if a safety check already exists for this route and driver
    const existingSafetyCheck = await prisma.safetyCheck.findFirst({
      where: {
        routeId,
        driverId: decoded.id,
        type,
        isDeleted: false,
      },
    });

    if (existingSafetyCheck) {
      return NextResponse.json(
        { message: "Safety check already submitted for this route" },
        { status: 400 }
      );
    }

    // Create the safety check with the correct format
    const safetyCheck = await prisma.$transaction(async (tx) => {
      // First, check if the route exists
      const routeExists = await tx.route.findUnique({
        where: { id: routeId },
      });

      if (!routeExists) {
        throw new Error("Route not found");
      }

      // Extract safety check fields (both enhanced and simplified)
      const {
        // Enhanced Vehicle & Fuel Check fields
        date,
        mileage1,
        mileage2,
        dieselLevel,
        palletsIn,
        palletsOut,
        dpfLevel,
        dieselReceipt,
        dollNumber,
        truckJackNumber,
        strapLevel,
        palletJackNumber,
        truckNumber,

        // Enhanced Fueling Details
        dieselAmount,
        creditCardNumber,
        fuelCapKeyNumber,
        creditCardCashAmount,
        cashBackAmount,

        // Enhanced Photo/Video Upload Checklist
        frontLightsPhoto,
        electricityBoxPhoto,
        palletsPhoto,
        vehicleConditionVideo,
        calledWarehouse,

        // Simplified Safety Check fields
        mileage,
        fuelLevel,
        lightsWorking,
        tiresCondition,
        braksWorking,
        vehicleClean,
        palletJackWorking,
        dolliesSecured,
        strapsAvailable,
        routeReviewed,
        warehouseContacted,

        // Common fields
        notes,
      } = details || {};

      // Then create the safety check with enhanced fields
      return await tx.safetyCheck.create({
        data: {
          type,
          responses: details || {}, // Keep original responses for backward compatibility
          timestamp: new Date(),
          route: {
            connect: { id: routeId },
          },
          driver: {
            connect: { id: decoded.id },
          },
          // Add enhanced fields if they exist
          date: date ? new Date(date) : undefined,
          mileage1: mileage1 || mileage, // Use simplified mileage if enhanced not available
          mileage2,
          dieselLevel: dieselLevel || fuelLevel, // Use simplified fuelLevel if enhanced not available
          palletsIn:
            palletsIn !== undefined
              ? parseInt(palletsIn.toString())
              : undefined,
          palletsOut:
            palletsOut !== undefined
              ? parseInt(palletsOut.toString())
              : undefined,
          dpfLevel,
          dieselReceipt,
          dollNumber,
          truckJackNumber,
          strapLevel,
          palletJackNumber,
          truckNumber,
          dieselAmount:
            dieselAmount !== undefined
              ? parseFloat(dieselAmount.toString())
              : undefined,
          creditCardNumber,
          fuelCapKeyNumber,
          creditCardCashAmount:
            creditCardCashAmount !== undefined
              ? parseFloat(creditCardCashAmount.toString())
              : undefined,
          cashBackAmount:
            cashBackAmount !== undefined
              ? parseFloat(cashBackAmount.toString())
              : undefined,
          frontLightsPhoto,
          electricityBoxPhoto,
          palletsPhoto,
          vehicleConditionVideo,
          calledWarehouse: calledWarehouse || warehouseContacted, // Use simplified field if enhanced not available
          notes,

          // Add simplified safety check fields
          lightsWorking,
          tiresCondition,
          braksWorking,
          vehicleClean,
          palletJackWorking,
          dolliesSecured,
          strapsAvailable,
          routeReviewed,
        },
      });
    });

    // Update route status based on safety check type
    if (type === "START_OF_DAY" && route.status === "PENDING") {
      // If this is a start of day safety check and the route is pending, update it to in progress
      await prisma.route.update({
        where: {
          id: routeId,
        },
        data: {
          status: "IN_PROGRESS",
        },
      });
    } else if (type === "END_OF_DAY" && route.status === "IN_PROGRESS") {
      // If this is an end of day safety check and the route is in progress, update it to completed
      // First check if all stops are completed
      const stops = await prisma.stop.findMany({
        where: {
          routeId,
          isDeleted: false,
          driverNameFromUpload: driverName,
        },
      });

      const allStopsCompleted = stops.every(
        (stop) => stop.status === "COMPLETED"
      );

      // Only mark the route as completed if all stops are completed
      if (allStopsCompleted || stops.length === 0) {
        await prisma.route.update({
          where: {
            id: routeId,
          },
          data: {
            status: "COMPLETED",
          },
        });
      }
    }

    return NextResponse.json({
      message: "Safety check submitted successfully",
      safetyCheck,
    });
  } catch (error) {
    console.error("Error submitting safety check:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
