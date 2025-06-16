import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Unwrap params
    const unwrappedParams = await Promise.resolve(params);
    const routeId = unwrappedParams.id;

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get export format from query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv"; // Default to CSV

    // Fetch route with all stop details
    const route = await prisma.route.findUnique({
      where: {
        id: routeId,
        isDeleted: false,
      },
      include: {
        driver: true,
        stops: {
          where: {
            isDeleted: false,
          },
          include: {
            customer: true,
            adminNotes: {
              include: {
                admin: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            sequence: "asc",
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json(
        { message: "Route not found" },
        { status: 404 }
      );
    }

    // Prepare export data
    const exportData = route.stops.map((stop) => ({
      // Basic Information
      "Route Number": route.routeNumber || "",
      "Route Date": (() => {
        try {
          return new Date(route.date).toISOString().split('T')[0];
        } catch (err) {
          return route.date ? String(route.date) : "Invalid Date";
        }
      })(),
      "Sequence": stop.sequence,
      "Customer Name": stop.customerNameFromUpload || stop.customer.name,
      "Customer Address": stop.address || stop.customer.address || "",
      "Customer Email": stop.customer.email || "",
      "Customer Group Code": stop.customer.groupCode || "",
      
      // Order Information
      "Order Number": stop.orderNumberWeb || "",
      "Invoice Number": stop.quickbooksInvoiceNum || "",
      "Amount": stop.amount || 0,
      
      // Driver Information
      "Assigned Driver": stop.driverNameFromUpload || route.driver?.fullName || route.driver?.username || "",
      
      // Status Information
      "Status": stop.status,
      "Is COD": stop.isCOD ? "Yes" : "No",
      
      // Payment Status (from Excel)
      "Payment Flag Cash": stop.paymentFlagCash ? "Yes" : "No",
      "Payment Flag Check": stop.paymentFlagCheck ? "Yes" : "No",
      "Payment Flag Credit Card": stop.paymentFlagCC ? "Yes" : "No",
      "Payment Flag Not Paid": stop.paymentFlagNotPaid ? "Yes" : "No",
      
      // Payment Amounts (from Excel)
      "Payment Amount Cash": stop.paymentAmountCash || 0,
      "Payment Amount Check": stop.paymentAmountCheck || 0,
      "Payment Amount Credit Card": stop.paymentAmountCC || 0,
      "Total Payment Amount": stop.totalPaymentAmount || 0,
      
      // Driver Recorded Payment
      "Driver Payment Amount": stop.driverPaymentAmount || 0,
      "Driver Payment Methods": stop.driverPaymentMethods ? stop.driverPaymentMethods.join(", ") : "",
      
      // Timing Information
      "Arrival Time": stop.arrivalTime ? new Date(stop.arrivalTime).toLocaleString() : "",
      "Completion Time": stop.completionTime ? new Date(stop.completionTime).toLocaleString() : "",
      
      // Notes
      "Initial Driver Notes": stop.initialDriverNotes || "",
      "Driver Notes": stop.driverNotes || "",
      "Driver Remarks": stop.driverRemarkInitial || "",
      "Admin Notes": stop.adminNotes.map(note => `${note.admin.username}: ${note.note}`).join(" | "),
      
      // Return Information
      "Return Flag": stop.returnFlagInitial ? "Yes" : "No",
      
      // Document Information
      "Invoice PDF URL": stop.signedInvoicePdfUrl || "",
      "Invoice Images": stop.invoiceImageUrls ? stop.invoiceImageUrls.join(", ") : "",
      
      // Timestamps
      "Created At": stop.createdAt.toLocaleString(),
      "Updated At": stop.updatedAt.toLocaleString(),
    }));

    if (format === "json") {
      // Return JSON format
      return NextResponse.json({
        route: {
          id: route.id,
          routeNumber: route.routeNumber,
          date: new Date(route.date).toISOString().split('T')[0],
          status: route.status,
          driver: route.driver,
          totalStops: route.stops.length,
          exportedAt: new Date().toISOString(),
        },
        stops: exportData,
      });
    } else {
      // Return CSV format
      if (exportData.length === 0) {
        return new NextResponse("No data to export", { status: 400 });
      }

      // Generate CSV content
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(","),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in CSV
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        )
      ].join("\n");

      // Set appropriate headers for file download
      const filename = `route-${route.routeNumber || route.id}-${new Date(route.date).toISOString().split('T')[0]}.csv`;
      
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error("Error exporting route:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
