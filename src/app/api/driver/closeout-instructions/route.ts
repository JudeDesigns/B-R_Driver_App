import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

const VALID_TYPES = ["WAREHOUSE", "JETRO"];

// GET /api/driver/closeout-instructions?type=WAREHOUSE|JETRO - Read-only
// access for drivers to fetch the admin-configured check-in instructions for
// the given closeout type. If no type is provided, returns both.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || decoded.role !== "DRIVER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get("type");

    if (type && !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { message: "type must be one of WAREHOUSE, JETRO" },
        { status: 400 }
      );
    }

    if (type) {
      const row = await prisma.closeoutInstructions.findUnique({
        where: { type: type as "WAREHOUSE" | "JETRO" },
      });

      return NextResponse.json({
        instructions: row ? row.instructions : null,
      });
    }

    const rows = await prisma.closeoutInstructions.findMany();
    const result: Record<string, string | null> = {
      WAREHOUSE: null,
      JETRO: null,
    };

    for (const row of rows) {
      result[row.type] = row.instructions;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching driver closeout instructions:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
