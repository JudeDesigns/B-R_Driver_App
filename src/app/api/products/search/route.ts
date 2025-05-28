import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Get search term from query parameters
    const searchParams = request.nextUrl.searchParams;
    const term = searchParams.get("term");

    if (!term || term.length < 3) {
      return NextResponse.json(
        { message: "Search term must be at least 3 characters" },
        { status: 400 }
      );
    }

    // Search for products
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { sku: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        unit: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 20, // Limit results to 20 products
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error searching products:", error);
    return NextResponse.json(
      { message: "An error occurred while searching products" },
      { status: 500 }
    );
  }
}
