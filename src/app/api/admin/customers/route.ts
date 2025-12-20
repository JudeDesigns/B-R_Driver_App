import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// Helper function to merge additional duplicate customers within a transaction
async function mergeAdditionalCustomersInTransaction(tx: any, existingCustomers: any[], primaryCustomerId: string) {
  const duplicatesToMerge = existingCustomers.filter(c => c.id !== primaryCustomerId);

  for (const duplicate of duplicatesToMerge) {
    console.log(`🔄 Merging duplicate customer ${duplicate.id} into ${primaryCustomerId}`);

    // Update all stops to reference the primary customer
    await tx.stop.updateMany({
      where: {
        customerId: duplicate.id,
      },
      data: {
        customerId: primaryCustomerId,
      },
    });

    // Update all documents to reference the primary customer
    await tx.document.updateMany({
      where: {
        customerId: duplicate.id,
      },
      data: {
        customerId: primaryCustomerId,
      },
    });

    // Soft delete the duplicate customer
    await tx.customer.update({
      where: {
        id: duplicate.id,
      },
      data: {
        isDeleted: true,
      },
    });

    console.log(`✅ Merged and deleted duplicate customer: ${duplicate.name} (${duplicate.id})`);
  }
}

// GET /api/admin/customers - Get all customers with pagination and search
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");
    const search = searchParams.get("search") || "";

    // Build the where clause for search
    const where = {
      isDeleted: false,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { address: { contains: search, mode: "insensitive" as const } },
              {
                contactInfo: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              { groupCode: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // Get customers with pagination
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.customer.count({ where });

    return NextResponse.json({ customers, totalCount });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// POST /api/admin/customers - Create a new customer
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

    // Get the customer data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.address) {
      return NextResponse.json(
        { message: "Name and address are required" },
        { status: 400 }
      );
    }

    // Check if customer name contains an email address (has @ symbol)
    if (data.name.includes("@")) {
      return NextResponse.json(
        { message: "Customer name cannot contain an email address" },
        { status: 400 }
      );
    }

    // Check for existing customers with the same name
    const existingCustomers = await prisma.customer.findMany({
      where: {
        name: data.name,
        isDeleted: false,
      },
      include: {
        stops: {
          select: {
            id: true,
          },
        },
      },
    });

    if (existingCustomers.length > 0) {
      // Auto-merge logic: Update the existing customer with complete data
      const result = await prisma.$transaction(async (tx) => {
        const existingCustomer = existingCustomers[0];

        console.log(`🔄 Auto-merging customer: ${data.name}`);
        console.log(`📊 Found ${existingCustomers.length} existing customer(s) with ${existingCustomer.stops.length} stops`);

        // Update the existing customer with the new complete data
        const updatedCustomer = await tx.customer.update({
          where: {
            id: existingCustomer.id,
          },
          data: {
            address: data.address || existingCustomer.address,
            contactInfo: data.contactInfo || existingCustomer.contactInfo,
            email: data.email || existingCustomer.email,
            preferences: data.preferences || existingCustomer.preferences,
            groupCode: data.groupCode || existingCustomer.groupCode,
            paymentTerms: data.paymentTerms || existingCustomer.paymentTerms,
            deliveryInstructions: data.deliveryInstructions || existingCustomer.deliveryInstructions,
          },
        });

        // If there are multiple customers with the same name, merge them all
        if (existingCustomers.length > 1) {
          await mergeAdditionalCustomersInTransaction(tx, existingCustomers, existingCustomer.id);
        }

        return updatedCustomer;
      });

      console.log(`✅ Customer merged successfully: ${result.name}`);
      return NextResponse.json({
        ...result,
        _merged: true,
        _mergedCount: existingCustomers.length,
      }, { status: 200 });
    }

    // No duplicates found, create new customer
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        address: data.address,
        contactInfo: data.contactInfo || null,
        email: data.email || null,
        preferences: data.preferences || null,
        groupCode: data.groupCode || null,
        paymentTerms: data.paymentTerms || "COD", // Default to COD
        deliveryInstructions: data.deliveryInstructions || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
