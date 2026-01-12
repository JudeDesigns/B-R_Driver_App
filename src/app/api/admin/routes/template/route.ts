import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import * as XLSX from "xlsx";

/**
 * GET /api/admin/routes/template
 * Generate and download a route upload template file
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

    // Define the exact column headers as expected by the route parser
    const headers = [
      "Route #",                                      // Column A
      "S No",                                         // Column B
      "Driver",                                       // Column C
      "Customers",                                    // Column D
      "Customer GROUP CODE",                          // Column E
      "Customer Email",                               // Column F
      "Order # (Web)",                                // Column G
      "Date",                                         // Column H
      "NOTES to be updated at top of the INVOICE",   // Column I
      "Notes for Drivers",                            // Column J (AC in actual file)
      "COD Account/ Send Inv to Customer",            // Column K
      "Cash",                                         // Column L
      "Check",                                        // Column M
      "Credit Card",                                  // Column N
      "Payments & Returns Remarks",                   // Column O
      "Other Remarks",                                // Column P
      // Add placeholder columns to reach column AJ (35)
      ...Array(19).fill(""),                          // Columns Q-AJ (indices 16-34)
      "Invoice #",                                    // Column AJ (index 35)
      "Amount",                                       // Column AK (index 36)
      "Cash Amount",                                  // Column AL (index 37)
      "Check Amount",                                 // Column AM (index 38)
      "Credit Card Amount",                           // Column AN (index 39)
    ];

    // Create sample data rows to show the expected format
    const sampleData = [
      [
        "R-001",                    // Route #
        "1",                        // S No
        "John Driver",              // Driver
        "Sample Customer Inc",      // Customers
        "GRP001",                   // Customer GROUP CODE
        "customer@example.com",     // Customer Email
        "WEB-12345",                // Order # (Web)
        "2026-01-10",               // Date
        "Please handle with care",  // NOTES to be updated at top of the INVOICE
        "Deliver to back door",     // Notes for Drivers
        "Yes",                      // COD Account
        "Yes",                      // Cash
        "",                         // Check
        "",                         // Credit Card
        "",                         // Payments & Returns Remarks
        "",                         // Other Remarks
        ...Array(19).fill(""),      // Placeholder columns
        "INV-001",                  // Invoice # (Column AJ)
        "500.00",                   // Amount (Column AK)
        "250.00",                   // Cash Amount (Column AL)
        "150.00",                   // Check Amount (Column AM)
        "100.00",                   // Credit Card Amount (Column AN)
      ],
      [
        "R-001",                    // Route #
        "2",                        // S No
        "John Driver",              // Driver
        "Another Customer LLC",     // Customers
        "GRP002",                   // Customer GROUP CODE
        "another@example.com",      // Customer Email
        "WEB-12346",                // Order # (Web)
        "2026-01-10",               // Date
        "",                         // NOTES
        "Call before delivery",     // Notes for Drivers
        "",                         // COD Account
        "",                         // Cash
        "Yes",                      // Check
        "",                         // Credit Card
        "",                         // Payments & Returns Remarks
        "",                         // Other Remarks
        ...Array(19).fill(""),      // Placeholder columns
        "INV-002",                  // Invoice # (Column AJ)
        "750.00",                   // Amount (Column AK)
        "",                         // Cash Amount (Column AL)
        "750.00",                   // Check Amount (Column AM)
        "",                         // Credit Card Amount (Column AN)
      ],
      // Add empty rows for users to fill in
      ...Array(5).fill(Array(headers.length).fill("")),
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheetData = [headers, ...sampleData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 10 },  // Route #
      { wch: 6 },   // S No
      { wch: 15 },  // Driver
      { wch: 25 },  // Customers
      { wch: 15 },  // Customer GROUP CODE
      { wch: 25 },  // Customer Email
      { wch: 15 },  // Order # (Web)
      { wch: 12 },  // Date
      { wch: 30 },  // NOTES
      { wch: 30 },  // Notes for Drivers
      { wch: 10 },  // COD
      { wch: 8 },   // Cash
      { wch: 8 },   // Check
      { wch: 12 },  // Credit Card
      { wch: 25 },  // Payments & Returns
      { wch: 20 },  // Other Remarks
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Route Template");

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Return the file as a download
    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="route_upload_template_${new Date().toISOString().split('T')[0]}.xlsx"`,
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

