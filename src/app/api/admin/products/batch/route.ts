import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

// DELETE /api/admin/products/batch - Batch delete products
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "ADMIN") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get product IDs from request body
    const { productIds } = await request.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { message: "No product IDs provided" },
        { status: 400 }
      );
    }

    // Soft delete the products (set isDeleted to true)
    const result = await prisma.product.updateMany({
      where: {
        id: {
          in: productIds,
        },
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({
      message: `${result.count} products deleted successfully`,
      count: result.count,
    });
  } catch (error) {
    console.error("Error deleting products:", error);
    return NextResponse.json(
      { message: "Failed to delete products", error: String(error) },
      { status: 500 }
    );
  }
}
