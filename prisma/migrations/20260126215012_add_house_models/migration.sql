-- CreateEnum
CREATE TYPE "HouseRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "House" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseMember" (
    "id" SERIAL NOT NULL,
    "house_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" "HouseRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseMember_pkey" PRIMARY KEY ("id")
);

-- Step 1: Add columns as nullable first
ALTER TABLE "FortnightIncome" ADD COLUMN "house_id" INTEGER;
ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- Step 2: Create a default house for existing data
INSERT INTO "House" ("name", "created_at") VALUES ('Default House', NOW());

-- Step 3: Update existing FortnightIncome records to use the default house
UPDATE "FortnightIncome" SET "house_id" = (SELECT "id" FROM "House" WHERE "name" = 'Default House' LIMIT 1) WHERE "house_id" IS NULL;

-- Step 4: Update existing User records with temporary email/password
-- Generate email based on user id and a temporary password hash
-- Note: You should update these with real values after migration
UPDATE "User" SET 
    "email" = 'user' || "id" || '@temp.micasa.local',
    "password" = '$2a$10$temp.hash.please.update.after.migration'
WHERE "email" IS NULL OR "password" IS NULL;

-- Step 5: Make columns required
ALTER TABLE "FortnightIncome" ALTER COLUMN "house_id" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "password" SET NOT NULL;

-- Step 6: Add unique constraint for email
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Step 7: Add foreign keys and indexes
CREATE INDEX "HouseMember_house_id_idx" ON "HouseMember"("house_id");
CREATE INDEX "HouseMember_user_id_idx" ON "HouseMember"("user_id");
CREATE INDEX "FortnightIncome_house_id_idx" ON "FortnightIncome"("house_id");

ALTER TABLE "HouseMember" ADD CONSTRAINT "HouseMember_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HouseMember" ADD CONSTRAINT "HouseMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "House" ADD CONSTRAINT "House_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FortnightIncome" ADD CONSTRAINT "FortnightIncome_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
