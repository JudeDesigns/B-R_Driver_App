import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  verifyPasswordConfirmation,
  createPasswordConfirmationErrorResponse,
} from "@/lib/passwordConfirmation";
import * as argon2 from "argon2";

// Import session manager with error handling
let sessionManager: any = null;
try {
  const sessionModule = require("@/lib/sessionManager");
  sessionManager = sessionModule.sessionManager;
} catch (error) {
  console.warn("Session manager not available in admin users API");
}

// GET /api/admin/users/[id] - Get a specific user
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the user ID from the URL
    const userParams = await params;
    const id = userParams.id;

    // Get the user
    const user = await prisma.user.findUnique({
      where: {
        id,
        isDeleted: false,
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

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Get routes assigned to this user (if they're a driver)
    let assignedRoutes = [];
    if (user.role === "DRIVER") {
      // Look for routes where this driver has assigned stops
      assignedRoutes = await prisma.route.findMany({
        where: {
          OR: [
            { driverId: id }, // Direct route assignment
            {
              stops: {
                some: {
                  driverNameFromUpload: user.username,
                  isDeleted: false,
                },
              },
            }, // Stop-level assignment
          ],
          isDeleted: false,
        },
        orderBy: {
          date: "desc",
        },
        take: 10,
        select: {
          id: true,
          routeNumber: true,
          date: true,
          status: true,
          _count: {
            select: {
              stops: {
                where: {
                  OR: [
                    { driverNameFromUpload: user.username },
                    { route: { driverId: id } },
                  ],
                  isDeleted: false,
                },
              },
            },
          },
        },
      });
    }

    return NextResponse.json({ user, assignedRoutes });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users/[id] - Update a user
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

    if (
      !decoded ||
      !decoded.id ||
      !["ADMIN", "SUPER_ADMIN"].includes(decoded.role)
    ) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the user ID from the URL
    const id = params.id;

    // Get the update data from the request body
    const data = await request.json();

    // Check if the user exists
    const existingUser = await prisma.user.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};

    // Update username if provided and not already taken
    if (data.username && data.username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: {
          username: data.username,
        },
      });

      if (usernameExists) {
        return NextResponse.json(
          { message: "Username already exists" },
          { status: 400 }
        );
      }

      updateData.username = data.username;
    }

    // Update password if provided
    if (data.password) {
      updateData.password = await argon2.hash(data.password);
      // Invalidate all sessions for this user when password is changed
      try {
        sessionManager.invalidateUserSessions(id, 'Password changed by admin');
      } catch (error) {
        console.warn("Failed to invalidate user sessions:", error.message);
      }
    }

    // Update fullName if provided
    if (data.fullName !== undefined) {
      updateData.fullName = data.fullName;
    }

    // Update role if provided and valid
    if (data.role) {
      const validRoles = ["ADMIN", "SUPER_ADMIN", "DRIVER"];
      if (!validRoles.includes(data.role)) {
        return NextResponse.json(
          { message: "Invalid role. Must be ADMIN, SUPER_ADMIN, or DRIVER" },
          { status: 400 }
        );
      }
      updateData.role = data.role;
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - Delete a user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify password confirmation (includes authentication check)
    const passwordCheck = await verifyPasswordConfirmation(request);

    if (!passwordCheck.confirmed) {
      return createPasswordConfirmationErrorResponse(passwordCheck);
    }

    const decoded = {
      id: passwordCheck.userId,
      role: passwordCheck.userRole,
    };

    if (!["ADMIN", "SUPER_ADMIN"].includes(decoded.role as string)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get the user ID from the URL
    const id = params.id;

    // Check if the user exists
    const existingUser = await prisma.user.findUnique({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Prevent deleting your own account
    if (id === decoded.id) {
      return NextResponse.json(
        { message: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Check if the user has any routes assigned (if they're a driver)
    let hasRoutes = false;
    if (existingUser.role === "DRIVER") {
      const routeCount = await prisma.route.count({
        where: {
          driverId: id,
          isDeleted: false,
        },
      });
      hasRoutes = routeCount > 0;
    }

    // Soft delete the user
    const deletedUser = await prisma.user.update({
      where: {
        id,
      },
      data: {
        isDeleted: true,
      },
    });

    return NextResponse.json({
      message: "User deleted successfully",
      hasRoutes,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { message: `An error occurred: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
