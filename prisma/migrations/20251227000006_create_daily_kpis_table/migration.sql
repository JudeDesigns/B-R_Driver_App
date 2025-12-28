-- Migration: Create daily_kpis table for driver performance tracking
-- This stores daily KPI metrics for each driver

-- Create daily_kpis table
CREATE TABLE "daily_kpis" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,

    -- Mileage tracking
    "milesStart" DOUBLE PRECISION,
    "milesEnd" DOUBLE PRECISION,
    "milesDriven" DOUBLE PRECISION,

    -- Delivery metrics
    "totalDelivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stopsCompleted" INTEGER NOT NULL DEFAULT 0,
    "stopsTotal" INTEGER NOT NULL DEFAULT 0,

    -- Time tracking
    "timeStart" TIMESTAMP(3),
    "timeEnd" TIMESTAMP(3),
    "totalTime" INTEGER,

    -- Metadata
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

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

