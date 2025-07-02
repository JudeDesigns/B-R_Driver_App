import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Customer search API called");

    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ No authorization header");
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      console.log("❌ Invalid token");
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    console.log("✅ User authenticated:", decoded.role);

    // Check if user has admin privileges
    if (decoded.role !== "ADMIN" && decoded.role !== "SUPER_ADMIN") {
      console.log("❌ Access denied for role:", decoded.role);
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // Get search query
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    console.log("🔍 Search query:", query);

    if (!query || query.length < 2) {
      console.log("❌ Query too short");
      return NextResponse.json({
        customers: [],
        message: "Query must be at least 2 characters long"
      });
    }

    console.log("📊 Starting database query...");

    // First, let's check if we can connect to the database and count customers
    const totalCustomers = await prisma.customer.count();
    console.log(`📊 Total customers in database: ${totalCustomers}`);

    if (totalCustomers === 0) {
      console.log("❌ No customers found in database at all!");
      return NextResponse.json({
        customers: [],
        message: "No customers exist in database",
        debug: { totalCustomers: 0 }
      });
    }

    // Check active customers
    const activeCount = await prisma.customer.count({
      where: { isDeleted: false }
    });
    console.log(`📊 Active customers: ${activeCount}`);

    // Now try the search
    console.log(`🔍 Searching for customers matching "${query}"...`);

    const customers = await prisma.customer.findMany({
      where: {
        isDeleted: false, // Put the filter back
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
      },
      orderBy: [
        {
          name: "asc",
        },
      ],
      take: 20,
    });

    console.log(`✅ Search completed: Found ${customers.length} customers`);

    if (customers.length > 0) {
      console.log("📋 Results:", customers.map(c => ({ id: c.id, name: c.name })));
    } else {
      console.log("❌ No customers matched the search criteria");

      // Let's try a broader search to see what's available
      const sampleCustomers = await prisma.customer.findMany({
        where: { isDeleted: false },
        select: { name: true },
        take: 5,
        orderBy: { name: "asc" }
      });

      console.log("📋 Sample customer names in database:", sampleCustomers.map(c => c.name));
    }

    return NextResponse.json({
      customers,
      total: customers.length,
      debug: {
        totalCustomers,
        activeCustomers: activeCount,
        searchQuery: query
      }
    });

  } catch (error) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
