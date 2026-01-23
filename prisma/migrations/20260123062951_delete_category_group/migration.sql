/*
  Warnings:

  - You are about to drop the column `group` on the `Category` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Card_name_key";

-- DropIndex
DROP INDEX "Category_group_idx";

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "group",
ADD COLUMN     "description" TEXT;

-- DropEnum
DROP TYPE "CategoryGroup";
