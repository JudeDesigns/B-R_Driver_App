import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const status = searchParams.get("status");

    // Build where clause for filtering
    const whereClause: any = {
      isDeleted: false,
    };

    if (dateFrom) {
      whereClause.date = {
        ...whereClause.date,
        gte: new Date(dateFrom),
      };
    }

    if (dateTo) {
      whereClause.date = {
        ...whereClause.date,
        lte: new Date(dateTo),
      };
    }

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    // Fetch routes with all stop details including payments
    const routes = await prisma.route.findMany({
      where: whereClause,
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
            payments: {
              orderBy: {
                createdAt: "desc",
              },
            },
            returns: {
              where: {
                isDeleted: false,
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
      orderBy: [
        { date: "desc" },
        { routeNumber: "asc" },
      ],
    });

    if (routes.length === 0) {
      return new NextResponse("No routes found for export", { status: 400 });
    }

    // Helper functions for clean data formatting
    const formatDate = (date: any): string => {
      if (!date) return "";
      try {
        return new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD format
      } catch {
        return "";
      }
    };

    const formatDateTime = (date: any): string => {
      if (!date) return "";
      try {
        return new Date(date).toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } catch {
        return "";
      }
    };

    const formatCurrency = (amount: any): string => {
      if (!amount || isNaN(amount)) return "0.00";
      return parseFloat(amount).toFixed(2);
    };

    const formatYesNo = (value: boolean): string => {
      return value ? "Yes" : "No";
    };

    const cleanText = (text: any): string => {
      if (!text) return "";
      return String(text).replace(/[\r\n\t]/g, ' ').trim();
    };

    // Prepare clean, organized export data
    const exportData: any[] = [];

    routes.forEach((route) => {
      route.stops.forEach((stop) => {
        // Calculate payment status
        const hasDriverPayments = stop.payments && stop.payments.length > 0;
        const totalDriverPayments = hasDriverPayments
          ? stop.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0)
          : 0;

        const paymentStatus = hasDriverPayments ? "Paid" :
          (stop.paymentFlagNotPaid ? "Not Paid" :
          (stop.paymentFlagCash || stop.paymentFlagCheck || stop.paymentFlagCC ? "Paid" : "Unknown"));

        // Format individual payments
        const individualPayments = hasDriverPayments
          ? stop.payments.map((p: any) => `${formatCurrency(p.amount)} (${p.method}${p.notes ? ` - ${p.notes}` : ''})`).join('; ')
          : "";

        // Format returns
        const returnsInfo = stop.returns && stop.returns.length > 0
          ? stop.returns.map((r: any) => `${r.productDescription || 'Unknown'} (Qty: ${r.quantity || 0})`).join('; ')
          : "";

        exportData.push({
          // === ROUTE INFORMATION ===
          "Route Number": cleanText(route.routeNumber) || "",
          "Route Date": formatDate(route.date),
          "Route Status": cleanText(route.status),
          "Route Driver": cleanText(route.driver?.fullName || route.driver?.username) || "",

          // === STOP BASIC INFO ===
          "Stop Sequence": stop.sequence || 0,
          "Stop Status": cleanText(stop.status),
          "Stop ID": cleanText(stop.id),

          // === CUSTOMER INFORMATION ===
          "Customer Name": cleanText(stop.customerNameFromUpload || stop.customer.name),
          "Customer Address": cleanText(stop.address || stop.customer.address),
          "Customer Email": cleanText(stop.customer.email),
          "Customer Group Code": cleanText(stop.customer.groupCode),

          // === ORDER DETAILS ===
          "Order Number": cleanText(stop.orderNumberWeb),
          "Invoice Number": cleanText(stop.quickbooksInvoiceNum),
          "Order Amount": formatCurrency(stop.amount),
          "Is COD": formatYesNo(stop.isCOD),

          // === DRIVER ASSIGNMENT ===
          "Assigned Driver": cleanText(stop.driverNameFromUpload || route.driver?.fullName || route.driver?.username),

          // === PAYMENT INFORMATION ===
          "Payment Status": paymentStatus,
          "Driver Recorded Payments": individualPayments,
          "Total Driver Payment Amount": formatCurrency(totalDriverPayments),

          // Legacy Payment Flags (from Excel upload)
          "Excel Payment Cash": formatYesNo(stop.paymentFlagCash),
          "Excel Payment Check": formatYesNo(stop.paymentFlagCheck),
          "Excel Payment Credit Card": formatYesNo(stop.paymentFlagCC),
          "Excel Payment Not Paid": formatYesNo(stop.paymentFlagNotPaid),

          // Legacy Payment Amounts (from Excel upload)
          "Excel Cash Amount": formatCurrency(stop.paymentAmountCash),
          "Excel Check Amount": formatCurrency(stop.paymentAmountCheck),
          "Excel Credit Card Amount": formatCurrency(stop.paymentAmountCC),
          "Excel Total Payment": formatCurrency(stop.totalPaymentAmount),

          // === DELIVERY TIMING ===
          "Arrival Time": formatDateTime(stop.arrivalTime),
          "Completion Time": formatDateTime(stop.completionTime),
          "On The Way Time": formatDateTime(stop.onTheWayTime),

          // === NOTES AND COMMENTS ===
          "Initial Driver Notes": cleanText(stop.initialDriverNotes),
          "Driver Delivery Notes": cleanText(stop.driverNotes),
          "Driver Remarks": cleanText(stop.driverRemarkInitial),
          "Admin Notes": stop.adminNotes.length > 0
            ? stop.adminNotes.map((note: any) => `[${note.admin.username}] ${cleanText(note.note)}`).join(' | ')
            : "",

          // === RETURNS INFORMATION ===
          "Has Returns": formatYesNo(stop.returnFlagInitial),
          "Return Details": returnsInfo,

          // === DOCUMENTS ===
          "Signed Invoice PDF": stop.signedInvoicePdfUrl ? "Yes" : "No",
          "Invoice Images Count": stop.invoiceImageUrls ? stop.invoiceImageUrls.length : 0,

          // === RECORD TIMESTAMPS ===
          "Stop Created": formatDateTime(stop.createdAt),
          "Stop Last Updated": formatDateTime(stop.updatedAt),
        });
      });
    });

    if (format === "json") {
      // Return JSON format
      return NextResponse.json({
        summary: {
          totalRoutes: routes.length,
          totalStops: exportData.length,
          exportedAt: new Date().toISOString(),
          filters: {
            dateFrom,
            dateTo,
            status,
          },
        },
        routes: routes.map(route => ({
          id: route.id,
          routeNumber: route.routeNumber,
          date: new Date(route.date).toISOString().split('T')[0],
          status: route.status,
          driver: route.driver,
          stopsCount: route.stops.length,
        })),
        stops: exportData,
      });
    } else {
      // Return CSV format
      if (exportData.length === 0) {
        return new NextResponse("No data to export", { status: 400 });
      }

      // Helper function to properly escape CSV values
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return "";

        const stringValue = String(value);

        // If the value contains comma, quote, newline, or carriage return, wrap in quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
          // Escape quotes by doubling them and wrap the whole value in quotes
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      };

      // Generate clean CSV content with proper headers
      const headers = Object.keys(exportData[0]);

      // Create CSV with UTF-8 BOM for better Excel compatibility
      const BOM = '\uFEFF';
      const csvContent = BOM + [
        // Header row
        headers.map(header => escapeCsvValue(header)).join(","),
        // Data rows
        ...exportData.map(row =>
          headers.map(header => escapeCsvValue(row[header as keyof typeof row])).join(",")
        )
      ].join("\n");

      // Set appropriate headers for file download with descriptive filename
      const dateRange = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().split('T')[0];
      const statusFilter = status && status !== "ALL" ? `_${status.toLowerCase()}` : "";
      const totalRoutes = routes.length;
      const totalStops = exportData.length;
      const filename = `B&R_Routes_Export_${dateRange}${statusFilter}_${totalRoutes}routes_${totalStops}stops.csv`;
      
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (error) {
    console.error("Error exporting routes:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
