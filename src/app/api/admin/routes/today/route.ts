import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/routes/today - Get all routes for today
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;
    
    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all routes for today
    const routes = await prisma.route.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
        isDeleted: false,
      },
      include: {
        driver: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        _count: {
          select: {
            stops: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate completion percentage for each route
    const routesWithStatus = await Promise.all(
      routes.map(async (route) => {
        // Get all stops for this route
        const stops = await prisma.stop.findMany({
          where: {
            routeId: route.id,
            isDeleted: false,
          },
          select: {
            id: true,
            status: true,
          },
        });

        // Calculate completion percentage
        const totalStops = stops.length;
        const completedStops = stops.filter(stop => stop.status === "COMPLETED").length;
        const completionPercentage = totalStops > 0 
          ? Math.round((completedStops / totalStops) * 100) 
          : 0;

        return {
          ...route,
          completionPercentage,
          completedStops,
          totalStops,
        };
      })
    );

    return NextResponse.json({
      routes: routesWithStatus,
    });
  } catch (error) {
    console.error("Error fetching today's routes:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
