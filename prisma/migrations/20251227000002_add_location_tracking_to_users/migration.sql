-- Migration: Add location tracking fields to users table
-- This enables real-time driver location tracking

-- Add location tracking columns
ALTER TABLE "users" ADD COLUMN "lastKnownLatitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "lastKnownLongitude" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "lastLocationUpdate" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "locationAccuracy" DOUBLE PRECISION;

