/*
  Warnings:

  - The `group` column on the `Category` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[user_id,name]` on the table `Card` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[start_date,end_date]` on the table `Fortnight` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fortnight_id,category_id]` on the table `FortnightAllocation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `PaymentMethod` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'CASH');

-- CreateEnum
CREATE TYPE "CategoryGroup" AS ENUM ('FIXED', 'VARIABLE', 'SAVINGS');

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "group",
ADD COLUMN     "group" "CategoryGroup";

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "expense_template_id" INTEGER;

-- AlterTable
ALTER TABLE "PaymentMethod" DROP COLUMN "type",
ADD COLUMN     "type" "PaymentMethodType" NOT NULL;

-- CreateTable
CREATE TABLE "ExpenseTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "user_id" INTEGER,
    "category_id" INTEGER NOT NULL,
    "default_card_id" INTEGER,
    "suggested_amount" DECIMAL(10,2),
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseTemplate_user_id_idx" ON "ExpenseTemplate"("user_id");

-- CreateIndex
CREATE INDEX "ExpenseTemplate_category_id_idx" ON "ExpenseTemplate"("category_id");

-- CreateIndex
CREATE INDEX "ExpenseTemplate_default_card_id_idx" ON "ExpenseTemplate"("default_card_id");

-- CreateIndex
CREATE INDEX "ExpenseTemplate_active_idx" ON "ExpenseTemplate"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseTemplate_name_key" ON "ExpenseTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Card_user_id_name_key" ON "Card"("user_id", "name");

-- CreateIndex
CREATE INDEX "Category_group_idx" ON "Category"("group");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Fortnight_start_date_end_date_key" ON "Fortnight"("start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "FortnightAllocation_fortnight_id_category_id_key" ON "FortnightAllocation"("fortnight_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_default_card_id_fkey" FOREIGN KEY ("default_card_id") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_expense_template_id_fkey" FOREIGN KEY ("expense_template_id") REFERENCES "ExpenseTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
