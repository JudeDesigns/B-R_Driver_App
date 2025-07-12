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
    });

    if (!route) {
      return NextResponse.json(
        { message: "Route not found" },
        { status: 404 }
      );
    }

    // Helper functions for clean data formatting in PST timezone
    const formatDate = (date: any): string => {
      if (!date) return "";
      try {
        const dateObj = new Date(date);
        return dateObj.toLocaleDateString("en-CA", {
          timeZone: "America/Los_Angeles"
        }); // YYYY-MM-DD format in PST
      } catch {
        return "";
      }
    };

    const formatDateTime = (date: any): string => {
      if (!date) return "";
      try {
        return new Date(date).toLocaleString('en-US', {
          timeZone: "America/Los_Angeles",
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
    const exportData = route.stops.map((stop) => {
      // Calculate payment status and amounts
      const hasDriverPayments = stop.payments && stop.payments.length > 0;
      const totalDriverPayments = hasDriverPayments
        ? stop.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0)
        : 0;

      // Use driver-recorded payments if available, otherwise fall back to upload amounts
      const finalPaymentAmount = stop.driverPaymentAmount || stop.totalPaymentAmount || 0;

      // Determine payment status with priority: driver payments > upload data
      let paymentStatus = "Unknown";
      if (hasDriverPayments && totalDriverPayments > 0) {
        paymentStatus = "Paid (Driver Recorded)";
      } else if (stop.driverPaymentAmount && stop.driverPaymentAmount > 0) {
        paymentStatus = "Paid (Driver Recorded)";
      } else if (stop.paymentFlagNotPaid) {
        paymentStatus = "Not Paid";
      } else if (stop.paymentFlagCash || stop.paymentFlagCheck || stop.paymentFlagCC) {
        paymentStatus = "Paid (From Upload)";
      } else if (stop.totalPaymentAmount && stop.totalPaymentAmount > 0) {
        paymentStatus = "Paid (From Upload)";
      }

      // Format individual driver payments with methods
      const driverPaymentDetails = hasDriverPayments
        ? stop.payments.map((p: any) => `${formatCurrency(p.amount)} (${p.method}${p.notes ? ` - ${p.notes}` : ''})`).join('; ')
        : "";

      // Format driver payment methods
      const driverPaymentMethods = hasDriverPayments
        ? [...new Set(stop.payments.map((p: any) => p.method))].join(', ')
        : "";

      // Format returns with SKU and description
      const returnsInfo = stop.returns && stop.returns.length > 0
        ? stop.returns.map((r: any) => {
            const sku = r.product?.sku || r.productSku || 'N/A';
            const desc = r.product?.description || r.productDescription || 'Unknown Product';
            return `${sku}: ${desc} (Qty: ${r.quantity || 0})`;
          }).join('; ')
        : "";

      return {
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
        "Final Payment Amount": formatCurrency(finalPaymentAmount),

        // Driver-Recorded Payment Details
        "Driver Payment Amount": formatCurrency(stop.driverPaymentAmount || 0),
        "Driver Payment Methods": driverPaymentMethods,
        "Driver Payment Details": driverPaymentDetails,
        "Driver Payment Count": hasDriverPayments ? stop.payments.length : 0,

        // Upload/Original Payment Information
        "Upload Total Payment": formatCurrency(stop.totalPaymentAmount || 0),
        "Upload Cash Amount": formatCurrency(stop.paymentAmountCash || 0),
        "Upload Check Amount": formatCurrency(stop.paymentAmountCheck || 0),
        "Upload Credit Card Amount": formatCurrency(stop.paymentAmountCC || 0),

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
        "Has Returns": formatYesNo(stop.returnFlagInitial || (stop.returns && stop.returns.length > 0)),
        "Return Count": stop.returns ? stop.returns.length : 0,
        "Return Details": returnsInfo,
        "Return Total Quantity": stop.returns && stop.returns.length > 0
          ? stop.returns.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)
          : 0,

        // === DOCUMENTS ===
        "Signed Invoice PDF": stop.signedInvoicePdfUrl ? "Yes" : "No",
        "Invoice Images Count": stop.invoiceImageUrls ? stop.invoiceImageUrls.length : 0,
        "PDF URL": stop.signedInvoicePdfUrl || "",

        // === DELIVERY PERFORMANCE ===
        "Delivery Duration (Minutes)": stop.arrivalTime && stop.completionTime
          ? Math.round((new Date(stop.completionTime).getTime() - new Date(stop.arrivalTime).getTime()) / (1000 * 60))
          : "",
        "Travel Time (Minutes)": stop.onTheWayTime && stop.arrivalTime
          ? Math.round((new Date(stop.arrivalTime).getTime() - new Date(stop.onTheWayTime).getTime()) / (1000 * 60))
          : "",

        // === RECORD TIMESTAMPS ===
        "Stop Created": formatDateTime(stop.createdAt),
        "Stop Last Updated": formatDateTime(stop.updatedAt),
      };
    });

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
      const routeDate = formatDate(route.date);
      const routeNumber = cleanText(route.routeNumber) || route.id.substring(0, 8);
      const driverName = cleanText(route.driver?.fullName || route.driver?.username) || "NoDriver";
      const totalStops = route.stops.length;
      const filename = `B&R_Route_${routeNumber}_${routeDate}_${driverName}_${totalStops}stops.csv`;
      
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
