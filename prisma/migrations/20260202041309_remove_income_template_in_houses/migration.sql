/*
  Warnings:

  - You are about to drop the column `house_id` on the `IncomeTemplate` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "IncomeTemplate" DROP CONSTRAINT "IncomeTemplate_house_id_fkey";

-- AlterTable
ALTER TABLE "IncomeTemplate" DROP COLUMN "house_id";
