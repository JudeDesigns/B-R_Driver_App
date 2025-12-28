-- Migration: Create daily_kpis table for driver performance tracking
-- This stores daily KPI metrics for each driver

-- Create daily_kpis table
CREATE TABLE "daily_kpis" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "stopsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalStops" INTEGER NOT NULL DEFAULT 0,
    "amountDelivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnsCount" INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveries" INTEGER NOT NULL DEFAULT 0,
    "lateDeliveries" INTEGER NOT NULL DEFAULT 0,
    "averageStopTime" DOUBLE PRECISION,
    "totalDistance" DOUBLE PRECISION,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_kpis_pkey" PRIMARY KEY ("id")
);

-- Create indexes for faster queries
CREATE INDEX "daily_kpis_driverId_idx" ON "daily_kpis"("driverId");
CREATE INDEX "daily_kpis_routeId_idx" ON "daily_kpis"("routeId");
CREATE INDEX "daily_kpis_date_idx" ON "daily_kpis"("date");
CREATE INDEX "daily_kpis_createdAt_idx" ON "daily_kpis"("createdAt");

-- Create unique constraint to prevent duplicate KPI records for same driver/date
CREATE UNIQUE INDEX "daily_kpis_driverId_date_key" ON "daily_kpis"("driverId", "date");

-- Add foreign key constraints
ALTER TABLE "daily_kpis" ADD CONSTRAINT "daily_kpis_driverId_fkey" 
    FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "daily_kpis" ADD CONSTRAINT "daily_kpis_routeId_fkey" 
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

