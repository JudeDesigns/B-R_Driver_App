import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

/**
 * GET /api/driver/safety-declarations
 * Get driver's safety declarations
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");
    const declarationType = searchParams.get("declarationType");

    // Build query
    const where: any = {
      driverId: decoded.id,
      isDeleted: false,
    };

    if (routeId) where.routeId = routeId;
    if (declarationType) where.declarationType = declarationType;

    // Fetch declarations
    const declarations = await prisma.safetyDeclaration.findMany({
      where,
      include: {
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
          },
        },
      },
      orderBy: {
        acknowledgedAt: "desc",
      },
    });

    return NextResponse.json({ declarations });
  } catch (error) {
    console.error("Error fetching safety declarations:", error);
    return NextResponse.json(
      { message: "Failed to fetch safety declarations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/driver/safety-declarations
 * Create a new safety declaration
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Validate required fields
    const requiredFields = [
      "vehicleInspected",
      "safetyEquipment",
      "routeUnderstood",
      "emergencyProcedures",
      "companyPolicies",
    ];

    for (const field of requiredFields) {
      if (data[field] !== true) {
        return NextResponse.json(
          { message: `All safety declarations must be acknowledged: ${field}` },
          { status: 400 }
        );
      }
    }

    // Get client IP and user agent for audit trail
    const ipAddress = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Create declaration
    const declaration = await prisma.safetyDeclaration.create({
      data: {
        driverId: decoded.id,
        routeId: data.routeId || null,
        declarationType: data.declarationType || "DAILY",
        vehicleInspected: data.vehicleInspected,
        safetyEquipment: data.safetyEquipment,
        routeUnderstood: data.routeUnderstood,
        emergencyProcedures: data.emergencyProcedures,
        companyPolicies: data.companyPolicies,
        signature: data.signature || decoded.username,
        ipAddress,
        userAgent,
      },
      include: {
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
          },
        },
      },
    });

    return NextResponse.json({ declaration }, { status: 201 });
  } catch (error) {
    console.error("Error creating safety declaration:", error);
    return NextResponse.json(
      { message: "Failed to create safety declaration" },
      { status: 500 }
    );
  }
}

