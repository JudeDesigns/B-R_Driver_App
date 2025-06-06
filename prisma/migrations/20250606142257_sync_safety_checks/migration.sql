-- AlterTable
ALTER TABLE "safety_checks" ADD COLUMN     "braksWorking" BOOLEAN,
ADD COLUMN     "dolliesSecured" BOOLEAN,
ADD COLUMN     "lightsWorking" BOOLEAN,
ADD COLUMN     "palletJackWorking" BOOLEAN,
ADD COLUMN     "routeReviewed" BOOLEAN,
ADD COLUMN     "strapsAvailable" BOOLEAN,
ADD COLUMN     "tiresCondition" BOOLEAN,
ADD COLUMN     "vehicleClean" BOOLEAN;
