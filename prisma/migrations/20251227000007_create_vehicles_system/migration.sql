-- Migration: Create vehicles and vehicle_assignments tables
-- This enables vehicle management and assignment tracking

-- Create VehicleStatus enum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED');

-- Create vehicles table
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "licensePlate" TEXT,
    "vin" TEXT,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- Create vehicle_assignments table
CREATE TABLE "vehicle_assignments" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vehicle_assignments_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "vehicles_vehicleNumber_key" ON "vehicles"("vehicleNumber");
CREATE INDEX "vehicles_vehicleNumber_idx" ON "vehicles"("vehicleNumber");
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");
CREATE INDEX "vehicles_isDeleted_idx" ON "vehicles"("isDeleted");

CREATE INDEX "vehicle_assignments_vehicleId_idx" ON "vehicle_assignments"("vehicleId");
CREATE INDEX "vehicle_assignments_driverId_idx" ON "vehicle_assignments"("driverId");
CREATE INDEX "vehicle_assignments_routeId_idx" ON "vehicle_assignments"("routeId");
CREATE INDEX "vehicle_assignments_isActive_idx" ON "vehicle_assignments"("isActive");
CREATE INDEX "vehicle_assignments_isDeleted_idx" ON "vehicle_assignments"("isDeleted");

-- Add foreign key constraints
ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_vehicleId_fkey" 
    FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_driverId_fkey" 
    FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vehicle_assignments" ADD CONSTRAINT "vehicle_assignments_routeId_fkey" 
    FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

