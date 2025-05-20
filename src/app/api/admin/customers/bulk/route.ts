import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// POST /api/admin/customers/bulk - Perform bulk operations on customers
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

    // Get the bulk operation data from the request body
    const data = await request.json();
    const { action, customerIds, updateData } = data;

    if (!action || !customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json(
        { message: "Invalid request. Action and customerIds are required." },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "delete":
        // Soft delete the selected customers
        result = await prisma.customer.updateMany({
          where: {
            id: {
              in: customerIds,
            },
          },
          data: {
            isDeleted: true,
          },
        });
        
        return NextResponse.json({
          message: `Successfully deleted ${result.count} customers`,
          count: result.count,
        });

      case "update":
        // Validate update data
        if (!updateData) {
          return NextResponse.json(
            { message: "Update data is required for update action" },
            { status: 400 }
          );
        }

        // Check if updating customer names to include email addresses
        if (updateData.name && updateData.name.includes('@')) {
          return NextResponse.json(
            { message: "Customer name cannot contain an email address" },
            { status: 400 }
          );
        }

        // Update the selected customers
        result = await prisma.customer.updateMany({
          where: {
            id: {
              in: customerIds,
            },
          },
          data: updateData,
        });
        
        return NextResponse.json({
          message: `Successfully updated ${result.count} customers`,
          count: result.count,
        });

      case "export":
        // Get the selected customers with all their data
        const customers = await prisma.customer.findMany({
          where: {
            id: {
              in: customerIds,
            },
            isDeleted: false,
          },
        });
        
        return NextResponse.json({
          message: `Successfully exported ${customers.length} customers`,
          customers,
        });

      default:
        return NextResponse.json(
          { message: `Unsupported action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error performing bulk operation:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
