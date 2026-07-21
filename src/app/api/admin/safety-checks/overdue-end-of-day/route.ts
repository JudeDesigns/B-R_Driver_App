import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { findOverdueEndOfDayDrivers } from "@/lib/overdueEndOfDay";

// GET /api/admin/safety-checks/overdue-end-of-day - List drivers whose last
// stop on a route was completed more than 3 hours ago and who have not yet
// submitted an End-of-Day safety check for that route. Read-only — used to
// populate the admin dashboard's "Overdue End-of-Day" panel.
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

    const overdue = await findOverdueEndOfDayDrivers(prisma);

    return NextResponse.json({ overdue });
  } catch (error) {
    console.error("Error fetching overdue end-of-day drivers:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
