import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import * as argon2 from "argon2";

// GET - List all users
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Unauthorized: Super Admin access required" },
        { status: 403 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const whereClause: any = {
      isDeleted: false, // Only show active users
    };
    if (role && role !== "ALL") {
      whereClause.role = role;
    }

    // Fetch users
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          // Don't include password hash
        },
        orderBy: [
          { role: "asc" },
          { fullName: "asc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      users,
      totalCount,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { message: "Unauthorized: Super Admin access required" },
        { status: 403 }
      );
    }

    // Parse request body
    const { username, fullName, password, role } = await request.json();

    // Validate input
    if (!username || !fullName || !password || !role) {
      return NextResponse.json(
        { message: "Username, full name, password, and role are required" },
        { status: 400 }
      );
    }

    if (!["ADMIN", "DRIVER", "SUPER_ADMIN"].includes(role)) {
      return NextResponse.json(
        { message: "Invalid role. Must be ADMIN, DRIVER, or SUPER_ADMIN" },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Username already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await argon2.hash(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        fullName,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
