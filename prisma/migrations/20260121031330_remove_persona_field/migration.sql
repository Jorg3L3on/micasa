/*
  Warnings:

  - You are about to drop the column `user_id` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `ExpenseTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `FortnightIncome` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Card` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_user_id_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_user_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseTemplate" DROP CONSTRAINT "ExpenseTemplate_user_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightIncome" DROP CONSTRAINT "FortnightIncome_user_id_fkey";

-- DropIndex
DROP INDEX "Card_user_id_idx";

-- DropIndex
DROP INDEX "Card_user_id_name_key";

-- DropIndex
DROP INDEX "Expense_user_id_idx";

-- DropIndex
DROP INDEX "ExpenseTemplate_user_id_idx";

-- DropIndex
DROP INDEX "FortnightIncome_user_id_idx";

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "user_id";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "user_id";

-- AlterTable
ALTER TABLE "ExpenseTemplate" DROP COLUMN "user_id";

-- AlterTable
ALTER TABLE "FortnightIncome" DROP COLUMN "user_id";

-- CreateIndex
CREATE UNIQUE INDEX "Card_name_key" ON "Card"("name");
