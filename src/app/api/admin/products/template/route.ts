import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import * as XLSX from "xlsx";

/**
 * GET /api/admin/products/template
 * Generate and download a product upload template file
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Define the exact column headers as expected by the product parser
    const headers = [
      "Product Name",
      "SKU",
      "Description",
      "Unit",
    ];

    // Create sample data rows to show the expected format
    const sampleData = [
      [
        "Sample Product 1",
        "SKU-001",
        "This is a sample product description",
        "Box",
      ],
      [
        "Sample Product 2",
        "SKU-002",
        "Another sample product with detailed description",
        "Case",
      ],
      [
        "Sample Product 3",
        "SKU-003",
        "Third sample product",
        "Each",
      ],
      // Add empty rows for users to fill in
      ...Array(10).fill(Array(headers.length).fill("")),
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheetData = [headers, ...sampleData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 30 },  // Product Name
      { wch: 15 },  // SKU
      { wch: 50 },  // Description
      { wch: 10 },  // Unit
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Product Template");

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Return the file as a download
    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="product_upload_template_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Template generation error:", error);
    return NextResponse.json(
      {
        message: "Failed to generate template",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

