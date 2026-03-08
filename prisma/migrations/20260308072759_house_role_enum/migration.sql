/*
  Warnings:

  - The values [VIEWER] on the enum `HouseRole` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[user_id,month,year,period]` on the table `Fortnight` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[house_id,month,year,period]` on the table `Fortnight` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_expense_id]` on the table `Transfer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[house_income_id]` on the table `Transfer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "HouseRole_new" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
ALTER TABLE "HouseMember" ALTER COLUMN "role" TYPE "HouseRole_new" USING ("role"::text::"HouseRole_new");
ALTER TYPE "HouseRole" RENAME TO "HouseRole_old";
ALTER TYPE "HouseRole_new" RENAME TO "HouseRole";
DROP TYPE "public"."HouseRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "HouseMember" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "house_income_id" INTEGER,
ADD COLUMN     "user_expense_id" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_user_id_idx" ON "Expense"("user_id");

-- CreateIndex
CREATE INDEX "Expense_house_id_idx" ON "Expense"("house_id");

-- CreateIndex
CREATE INDEX "Expense_fortnight_id_idx" ON "Expense"("fortnight_id");

-- CreateIndex
CREATE INDEX "Expense_wallet_id_idx" ON "Expense"("wallet_id");

-- CreateIndex
CREATE INDEX "Expense_expense_template_id_idx" ON "Expense"("expense_template_id");

-- CreateIndex
CREATE INDEX "ExpenseTemplate_user_id_idx" ON "ExpenseTemplate"("user_id");

-- CreateIndex
CREATE INDEX "ExpenseTemplate_house_id_idx" ON "ExpenseTemplate"("house_id");

-- CreateIndex
CREATE INDEX "Fortnight_user_id_idx" ON "Fortnight"("user_id");

-- CreateIndex
CREATE INDEX "Fortnight_house_id_idx" ON "Fortnight"("house_id");

-- CreateIndex
CREATE UNIQUE INDEX "Fortnight_user_id_month_year_period_key" ON "Fortnight"("user_id", "month", "year", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Fortnight_house_id_month_year_period_key" ON "Fortnight"("house_id", "month", "year", "period");

-- CreateIndex
CREATE INDEX "Income_user_id_idx" ON "Income"("user_id");

-- CreateIndex
CREATE INDEX "Income_house_id_idx" ON "Income"("house_id");

-- CreateIndex
CREATE INDEX "Income_fortnight_id_idx" ON "Income"("fortnight_id");

-- CreateIndex
CREATE INDEX "IncomeTemplate_user_id_idx" ON "IncomeTemplate"("user_id");

-- CreateIndex
CREATE INDEX "IncomeTemplate_house_id_idx" ON "IncomeTemplate"("house_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_user_expense_id_key" ON "Transfer"("user_expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_house_income_id_key" ON "Transfer"("house_income_id");

-- CreateIndex
CREATE INDEX "Transfer_user_id_idx" ON "Transfer"("user_id");

-- CreateIndex
CREATE INDEX "Transfer_house_id_idx" ON "Transfer"("house_id");

-- CreateIndex
CREATE INDEX "Transfer_created_at_idx" ON "Transfer"("created_at");

-- CreateIndex
CREATE INDEX "Wallet_user_id_idx" ON "Wallet"("user_id");

-- CreateIndex
CREATE INDEX "Wallet_house_id_idx" ON "Wallet"("house_id");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_user_expense_id_fkey" FOREIGN KEY ("user_expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_house_income_id_fkey" FOREIGN KEY ("house_income_id") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;
