/*
  Warnings:

  - You are about to drop the column `due_date` on the `Expense` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "due_date",
ADD COLUMN     "due_day" INTEGER;
