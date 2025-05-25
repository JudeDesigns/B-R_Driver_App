import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

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

    // Create the customer
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        address: data.address,
        contactInfo: data.contactInfo || null,
        email: data.email || null,
        preferences: data.preferences || null,
        groupCode: data.groupCode || null,
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
