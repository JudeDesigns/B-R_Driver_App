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

    console.log("📋 Loading all customers for dropdown...");

    // Use raw SQL to avoid isDeleted NULL issues
    const customers = await prisma.$queryRaw`
      SELECT id, name, email, phone, address, "groupCode"
      FROM customers 
      WHERE ("isDeleted" = false OR "isDeleted" IS NULL)
      ORDER BY name ASC
    `;

    console.log(`✅ Loaded ${customers.length} customers for dropdown`);

    return NextResponse.json({
      customers,
      total: customers.length,
    });

  } catch (error) {
    console.error("Error loading customers:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
