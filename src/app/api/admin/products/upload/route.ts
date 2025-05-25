import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { parseProductFile, processProducts } from "@/lib/productParser";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "ADMIN") {
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
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse the file
    const parseResult = await parseProductFile(buffer);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          message: "Failed to parse product file",
          errors: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    // Process the products
    const result = await processProducts(parseResult.products!);

    return NextResponse.json({
      message: "Products processed successfully",
      productsAdded: result.productsAdded,
      productsUpdated: result.productsUpdated,
      productsFailed: result.productsFailed,
      totalProcessed: result.totalProcessed,
      warnings: [...parseResult.warnings, ...result.warnings],
    });
  } catch (error) {
    console.error("Error uploading products:", error);
    return NextResponse.json(
      { message: "Failed to process product upload", error: String(error) },
      { status: 500 }
    );
  }
}
