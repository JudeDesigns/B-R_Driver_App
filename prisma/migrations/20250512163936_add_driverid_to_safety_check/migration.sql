/*
  Warnings:

  - Added the required column `driverId` to the `safety_checks` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "routes" DROP CONSTRAINT "routes_driverId_fkey";

-- AlterTable
ALTER TABLE "routes" ALTER COLUMN "driverId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "safety_checks" ADD COLUMN     "driverId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checks" ADD CONSTRAINT "safety_checks_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
