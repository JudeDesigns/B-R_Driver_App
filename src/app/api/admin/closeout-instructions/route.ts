import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

const VALID_TYPES = ["WAREHOUSE", "JETRO"];
const MAX_INSTRUCTIONS_LENGTH = 5000;

// GET /api/admin/closeout-instructions - Fetch the current Warehouse and
// Jetro check-in instructions (admin/super_admin only).
export async function GET(request: NextRequest) {
  try {
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

    const rows = await prisma.closeoutInstructions.findMany({
      include: {
        updater: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    const result: Record<string, any> = { WAREHOUSE: null, JETRO: null };

    for (const row of rows) {
      result[row.type] = {
        instructions: row.instructions,
        updatedAt: row.updatedAt,
        updatedBy: row.updater,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching closeout instructions:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PUT /api/admin/closeout-instructions - Create or update the check-in
// instructions for a given closeout type (admin/super_admin only).
//
// Body: { type: "WAREHOUSE" | "JETRO"; instructions: string }
export async function PUT(request: NextRequest) {
  try {
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

    const data = await request.json();
    const { type } = data;
    const instructions =
      typeof data.instructions === "string" ? data.instructions.trim() : "";

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { message: "type must be one of WAREHOUSE, JETRO" },
        { status: 400 }
      );
    }

    if (!instructions) {
      return NextResponse.json(
        { message: "instructions is required" },
        { status: 400 }
      );
    }

    if (instructions.length > MAX_INSTRUCTIONS_LENGTH) {
      return NextResponse.json(
        {
          message: `instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.closeoutInstructions.upsert({
      where: { type },
      create: { type, instructions, updatedBy: decoded.id },
      update: { instructions, updatedBy: decoded.id },
      include: {
        updater: {
          select: { id: true, username: true, fullName: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating closeout instructions:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
