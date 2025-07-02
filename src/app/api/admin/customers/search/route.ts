import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    // Check if user has admin privileges
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // Get search query
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({
        customers: [],
        message: "Query must be at least 2 characters long"
      });
    }

    // Search customers by name, email, or group code
    // First, let's try a broader search to see if the issue is with the isDeleted filter
    const customers = await prisma.customer.findMany({
      where: {
        // Remove isDeleted filter temporarily to test if that's the issue
        // isDeleted: false,
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            groupCode: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            phone: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        groupCode: true,
        isDeleted: true, // Include this to see the actual values
      },
      orderBy: [
        {
          name: "asc",
        },
      ],
      take: 20, // Limit results to prevent overwhelming the UI
    });

    // Filter out deleted customers manually and log what we find
    const activeCustomers = customers.filter(customer => !customer.isDeleted);

    console.log(`🔍 Search for "${query}": Found ${customers.length} total, ${activeCustomers.length} active`);
    if (customers.length > 0) {
      console.log("📋 Sample results:", customers.slice(0, 3).map(c => ({
        name: c.name,
        isDeleted: c.isDeleted
      })));
    }

    return NextResponse.json({
      customers: activeCustomers.map(({ isDeleted, ...customer }) => customer), // Remove isDeleted from response
      total: activeCustomers.length,
    });

  } catch (error) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
