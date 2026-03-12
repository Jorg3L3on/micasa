-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboarding_completed" BOOLEAN NOT NULL DEFAULT false;

-- Set onboarding_completed = true for existing users who already have a personal wallet
UPDATE "User"
SET "onboarding_completed" = true
WHERE id IN (SELECT DISTINCT "user_id" FROM "Wallet" WHERE "house_id" IS NULL AND "user_id" IS NOT NULL);
