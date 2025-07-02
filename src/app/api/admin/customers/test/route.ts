import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// Test endpoint to check customer data
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

    console.log("🧪 Testing customer database...");

    // Get basic stats
    const totalCustomers = await prisma.customer.count();
    const activeCustomers = await prisma.customer.count({
      where: { isDeleted: false }
    });
    const deletedCustomers = await prisma.customer.count({
      where: { isDeleted: true }
    });

    // Get sample customers
    const sampleCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        groupCode: true,
        isDeleted: true,
        createdAt: true,
      },
      take: 10,
      orderBy: { name: "asc" }
    });

    // Get active customers only
    const activeCustomerSample = await prisma.customer.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        groupCode: true,
      },
      take: 10,
      orderBy: { name: "asc" }
    });

    console.log(`📊 Database stats: ${totalCustomers} total, ${activeCustomers} active, ${deletedCustomers} deleted`);
    console.log(`📋 Sample active customers:`, activeCustomerSample.map(c => c.name));

    return NextResponse.json({
      stats: {
        total: totalCustomers,
        active: activeCustomers,
        deleted: deletedCustomers,
      },
      sampleCustomers,
      activeCustomers: activeCustomerSample,
      message: "Customer database test completed"
    });

  } catch (error) {
    console.error("Error testing customer database:", error);
    return NextResponse.json(
      { 
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
