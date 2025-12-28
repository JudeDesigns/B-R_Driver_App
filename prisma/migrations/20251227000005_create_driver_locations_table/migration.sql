-- Migration: Create driver_locations table for location history tracking
-- This stores historical location data for drivers during deliveries

-- Create driver_locations table
CREATE TABLE "driver_locations" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "stopId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

-- Create indexes for faster queries
CREATE INDEX "driver_locations_driverId_idx" ON "driver_locations"("driverId");
CREATE INDEX "driver_locations_routeId_idx" ON "driver_locations"("routeId");
CREATE INDEX "driver_locations_stopId_idx" ON "driver_locations"("stopId");
CREATE INDEX "driver_locations_timestamp_idx" ON "driver_locations"("timestamp");
CREATE INDEX "driver_locations_createdAt_idx" ON "driver_locations"("createdAt");

-- Add foreign key constraints
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driverId_fkey" 
    FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_routeId_fkey" 
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_stopId_fkey" 
    FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

