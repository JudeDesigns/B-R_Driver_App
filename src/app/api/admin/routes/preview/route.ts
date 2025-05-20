import { NextRequest, NextResponse } from "next/server";
import { parseRouteExcel } from "@/lib/routeParser";
import { verifyToken } from "@/lib/auth";

// POST /api/admin/routes/preview - Preview route data from Excel file
export async function POST(request: NextRequest) {
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

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    // Read the Excel file
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the Excel file
    const parseResult = await parseRouteExcel(buffer);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          message: "Failed to parse route data",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    // Return a preview of the route data
    return NextResponse.json({
      message: "Route data preview generated",
      routeNumber: parseResult.route?.routeNumber,
      date: parseResult.route?.date,
      stopCount: parseResult.route?.stops.length,
      // Return a sample of stops (first 5)
      sampleStops: parseResult.route?.stops.slice(0, 5),
      // Group drivers and count their stops
      driverSummary: parseResult.route?.stops.reduce((acc, stop) => {
        const driverName = stop.driverName || "Unknown";
        if (!acc[driverName]) {
          acc[driverName] = 0;
        }
        acc[driverName]++;
        return acc;
      }, {} as Record<string, number>),
      warnings: parseResult.warnings,
      rowsProcessed: parseResult.rowsProcessed,
      rowsSucceeded: parseResult.rowsSucceeded,
      rowsFailed: parseResult.rowsFailed,
    });
  } catch (error) {
    console.error("Route preview error:", error);
    return NextResponse.json(
      {
        message: `An error occurred during route preview: ${
          (error as Error).message
        }`,
      },
      { status: 500 }
    );
  }
}
