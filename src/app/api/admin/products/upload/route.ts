import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { parseProductFile, processProducts } from "@/lib/productParser";

// Configure body size limit for this route (Next.js 15)
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log("=== Product Upload Started ===");

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Product upload failed: No authorization header");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      console.log("Product upload failed: Invalid token or insufficient permissions");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    console.log(`Product upload by user: ${decoded.id} (${decoded.role})`);

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.log("Product upload failed: No file provided");
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    console.log(`File received: ${file.name}, Size: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.log(`Product upload failed: File too large (${file.size} bytes > ${maxSize} bytes)`);
      return NextResponse.json(
        { message: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      );
    }

    // Check file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (
      fileExtension !== "xlsx" &&
      fileExtension !== "xls" &&
      fileExtension !== "csv"
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid file format. Please upload a .xlsx, .xls, or .csv file",
        },
        { status: 400 }
      );
    }

    // Read the file
    console.log("Converting file to buffer...");
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`Buffer created: ${buffer.length} bytes`);

    // Parse the file
    console.log("Parsing product file...");
    const parseResult = await parseProductFile(buffer);

    if (!parseResult.success) {
      console.log("Product file parsing failed:", parseResult.errors);
      return NextResponse.json(
        {
          message: "Failed to parse product file",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    console.log(`Parsed ${parseResult.products?.length || 0} products from file`);

    // Process the products
    console.log("Processing products...");
    const result = await processProducts(parseResult.products!);

    console.log(`Products processed: ${result.productsAdded} added, ${result.productsUpdated} updated, ${result.productsFailed} failed`);
    console.log("=== Product Upload Completed Successfully ===");

    return NextResponse.json({
      message: "Products processed successfully",
      productsAdded: result.productsAdded,
      productsUpdated: result.productsUpdated,
      productsFailed: result.productsFailed,
      totalProcessed: result.totalProcessed,
      warnings: [...parseResult.warnings, ...result.warnings],
    });
  } catch (error) {
    console.error("=== Product Upload Error ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

    return NextResponse.json(
      {
        message: "Failed to process product upload",
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name || "Unknown",
        details: "Check server logs for more information"
      },
      { status: 500 }
    );
  }
}
