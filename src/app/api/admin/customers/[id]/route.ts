import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  verifyPasswordConfirmation,
  createPasswordConfirmationErrorResponse,
} from "@/lib/passwordConfirmation";

// GET /api/admin/customers/[id] - Get a specific customer with recent stops
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get the customer ID from the URL
    const customerParams = await params;
    const id = customerParams.id;

    // Get the customer
    const customer = await prisma.customer.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { message: "Customer not found" },
        { status: 404 }
      );
    }

    // Get pagination parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Get total count of stops for pagination
    const totalStops = await prisma.stop.count({
      where: {
        customerId: id,
        isDeleted: false,
      },
    });

    // Get recent stops for this customer with pagination
    const recentStops = await prisma.stop.findMany({
      where: {
        customerId: id,
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: offset,
      take: limit,
      include: {
        route: {
          select: {
            id: true,
            routeNumber: true,
            date: true,
          },
        },
      },
    });

    // Get customer documents
    const documents = await prisma.document.findMany({
      where: {
        customerId: id,
        isActive: true,
        isDeleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalStops / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      customer,
      recentStops,
      documents,
      pagination: {
        currentPage: page,
        totalPages,
        totalStops,
        hasNextPage,
        hasPrevPage,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/customers/[id] - Update a customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get the customer ID from the URL
    const id = params.id;

    // Get the update data from the request body
    const data = await request.json();

    // Validate required fields
    if (data.name === "" || data.address === "") {
      return NextResponse.json(
        { message: "Name and address cannot be empty" },
        { status: 400 }
      );
    }

    // Check if customer name contains an email address (has @ symbol)
    if (data.name && data.name.includes("@")) {
      return NextResponse.json(
        { message: "Customer name cannot contain an email address" },
        { status: 400 }
      );
    }

    // Check if the customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { message: "Customer not found" },
        { status: 404 }
      );
    }

    // Update the customer
    const updatedCustomer = await prisma.customer.update({
      where: {
        id,
      },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        address: data.address !== undefined ? data.address : undefined,
        contactInfo:
          data.contactInfo !== undefined ? data.contactInfo : undefined,
        email: data.email !== undefined ? data.email : undefined,
        preferences:
          data.preferences !== undefined ? data.preferences : undefined,
        groupCode: data.groupCode !== undefined ? data.groupCode : undefined,
        paymentTerms:
          data.paymentTerms !== undefined ? data.paymentTerms : undefined,
        deliveryInstructions:
          data.deliveryInstructions !== undefined
            ? data.deliveryInstructions
            : undefined,
      },
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/customers/[id] - Delete a customer (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify password confirmation (includes authentication check)
    const passwordCheck = await verifyPasswordConfirmation(request);

    if (!passwordCheck.confirmed) {
      return createPasswordConfirmationErrorResponse(passwordCheck);
    }

    const decoded = {
      id: passwordCheck.userId,
      role: passwordCheck.userRole,
    };

    if (!["ADMIN", "SUPER_ADMIN"].includes(decoded.role as string)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the customer ID from the URL
    const id = params.id;

    // Check if the customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { message: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if the customer has any stops
    const customerStops = await prisma.stop.findMany({
      where: {
        customerId: id,
        isDeleted: false,
      },
    });

    // Soft delete the customer
    const deletedCustomer = await prisma.customer.update({
      where: {
        id,
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({
      message: "Customer deleted successfully",
      hasStops: customerStops.length > 0,
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
