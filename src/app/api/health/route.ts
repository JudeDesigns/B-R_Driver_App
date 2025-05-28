import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * Health check endpoint for monitoring and load balancers
 * GET /api/health
 */
export async function GET(request: NextRequest) {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    // Basic application health
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "connected",
      uptime: process.uptime(),
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    // Database connection failed
    const health = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: "disconnected",
      uptime: process.uptime(),
      error: process.env.NODE_ENV === "production" ? "Database connection failed" : (error as Error).message,
    };

    return NextResponse.json(health, { status: 503 });
  }
}
