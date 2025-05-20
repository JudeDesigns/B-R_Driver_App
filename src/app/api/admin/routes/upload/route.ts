import { NextRequest, NextResponse } from "next/server";
import { parseRouteExcel, saveRouteToDatabase } from "@/lib/routeParser";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

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

    // Create a record of the upload
    const uploadRecord = await prisma.routeUpload.create({
      data: {
        fileName: `route_${Date.now()}.xlsx`,
        originalFileName: file.name,
        uploadedBy: decoded.id,
        status: "PROCESSING",
      },
    });

    // Read the Excel file
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the Excel file
    const parseResult = await parseRouteExcel(buffer);

    // Update the upload record with parsing results
    await prisma.routeUpload.update({
      where: { id: uploadRecord.id },
      data: {
        rowsProcessed: parseResult.rowsProcessed,
        rowsSucceeded: parseResult.rowsSucceeded,
        rowsFailed: parseResult.rowsFailed,
        status: parseResult.success ? "COMPLETED" : "FAILED",
        errorMessage:
          parseResult.errors.length > 0 ? parseResult.errors.join("; ") : null,
        processedAt: new Date(),
      },
    });

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

    // Save the route to the database
    const result = await saveRouteToDatabase(
      parseResult.route!,
      decoded.id,
      uploadRecord.fileName
    );

    const { route, isUpdate } = result;

    return NextResponse.json({
      message: isUpdate
        ? "Route updated successfully"
        : "Route uploaded and processed successfully",
      routeId: route.id,
      routeNumber: route.routeNumber,
      // driverName removed as requested
      stopCount: parseResult.route!.stops.length,
      warnings: parseResult.warnings,
      rowsProcessed: parseResult.rowsProcessed,
      rowsSucceeded: parseResult.rowsSucceeded,
      rowsFailed: parseResult.rowsFailed,
      isUpdate: isUpdate,
    });
  } catch (error) {
    console.error("Route upload error:", error);
    return NextResponse.json(
      {
        message: `An error occurred during route upload: ${
          (error as Error).message
        }`,
      },
      { status: 500 }
    );
  }
}
