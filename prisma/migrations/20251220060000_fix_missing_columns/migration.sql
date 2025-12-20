-- AlterTable
ALTER TABLE "users" ADD COLUMN "attendanceAppUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "lastClockInStatusCheck" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "cachedClockInStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "cachedClockInStatusAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "lastKnownLatitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "lastKnownLongitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "lastLocationUpdate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "locationAccuracy" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "users_attendanceAppUserId_idx" ON "users"("attendanceAppUserId");

-- CreateTable
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

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_locations_driverId_idx" ON "driver_locations"("driverId");
CREATE INDEX "driver_locations_routeId_idx" ON "driver_locations"("routeId");
CREATE INDEX "driver_locations_stopId_idx" ON "driver_locations"("stopId");
CREATE INDEX "driver_locations_timestamp_idx" ON "driver_locations"("timestamp");
CREATE INDEX "driver_locations_createdAt_idx" ON "driver_locations"("createdAt");

-- AddForeignKey
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "driver_locations" ADD CONSTRAINT "driver_locations_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "stops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
