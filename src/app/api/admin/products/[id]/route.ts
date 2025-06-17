import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// GET /api/admin/products/[id] - Get a specific product
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the product ID from the URL
    const id = params.id;

    // Get the product
    const product = await prisma.product.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!product) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/products/[id] - Update a product
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the product ID from the URL
    const id = params.id;

    // Get the update data from the request body
    const data = await request.json();

    // Validate required fields
    if (data.name === "" || data.sku === "") {
      return NextResponse.json(
        { message: "Name and SKU cannot be empty" },
        { status: 400 }
      );
    }

    // Check if the product exists
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 }
      );
    }

    // Check if SKU is being changed and if it already exists
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuExists = await prisma.product.findFirst({
        where: {
          sku: data.sku,
          id: { not: id },
          isDeleted: false,
        },
      });

      if (skuExists) {
        return NextResponse.json(
          { message: "A product with this SKU already exists" },
          { status: 400 }
        );
      }
    }

    // Update the product
    const updatedProduct = await prisma.product.update({
      where: {
        id,
      },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        sku: data.sku !== undefined ? data.sku : undefined,
        description: data.description !== undefined ? data.description : undefined,
        unit: data.unit !== undefined ? data.unit : undefined,
      },
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Delete a product (soft delete)
export async function DELETE(
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

    if (!decoded || !decoded.id || !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the product ID from the URL
    const id = params.id;

    // Check if the product exists
    const existingProduct = await prisma.product.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 }
      );
    }

    // Soft delete the product
    const deletedProduct = await prisma.product.update({
      where: {
        id,
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({
      message: "Product deleted successfully",
      id: deletedProduct.id,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
