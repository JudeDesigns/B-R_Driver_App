-- Migration: Add attendance app integration fields to users table
-- This enables integration with external attendance tracking system

-- Add attendance app integration columns
ALTER TABLE "users" ADD COLUMN "attendanceAppUserId" TEXT;
ALTER TABLE "users" ADD COLUMN "lastClockInStatusCheck" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "cachedClockInStatus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "cachedClockInStatusAt" TIMESTAMP(3);

-- Add index for faster lookups
CREATE INDEX "users_attendanceAppUserId_idx" ON "users"("attendanceAppUserId");

