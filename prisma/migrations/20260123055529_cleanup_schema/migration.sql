/*
  Warnings:

  - You are about to drop the `FortnightAllocation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FortnightBalance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserFortnightSummary` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FortnightAllocation" DROP CONSTRAINT "FortnightAllocation_category_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightAllocation" DROP CONSTRAINT "FortnightAllocation_fortnight_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightBalance" DROP CONSTRAINT "FortnightBalance_fortnight_id_fkey";

-- DropForeignKey
ALTER TABLE "UserFortnightSummary" DROP CONSTRAINT "UserFortnightSummary_fortnight_id_fkey";

-- DropForeignKey
ALTER TABLE "UserFortnightSummary" DROP CONSTRAINT "UserFortnightSummary_user_id_fkey";

-- DropTable
DROP TABLE "FortnightAllocation";

-- DropTable
DROP TABLE "FortnightBalance";

-- DropTable
DROP TABLE "UserFortnightSummary";
