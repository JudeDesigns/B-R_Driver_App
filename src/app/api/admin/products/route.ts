import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/products - Get all products with pagination and search
export async function GET(request: NextRequest) {
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
              { sku: { contains: search, mode: "insensitive" as const } },
              {
                description: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    // Get products with pagination
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.product.count({ where });

    return NextResponse.json({
      products,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// POST /api/admin/products - Create a new product
export async function POST(request: NextRequest) {
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

    // Get the product data from the request body
    const data = await request.json();

    // Validate required fields
    if (!data.name || !data.sku) {
      return NextResponse.json(
        { message: "Name and SKU are required" },
        { status: 400 }
      );
    }

    // Check if SKU already exists
    const existingSku = await prisma.product.findFirst({
      where: {
        sku: data.sku,
        isDeleted: false,
      },
    });

    if (existingSku) {
      return NextResponse.json(
        { message: "A product with this SKU already exists" },
        { status: 400 }
      );
    }

    // Create the product
    const product = await prisma.product.create({
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description || null,
        unit: data.unit || null,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
