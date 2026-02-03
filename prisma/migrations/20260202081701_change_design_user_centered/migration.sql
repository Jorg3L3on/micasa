/*
  Warnings:

  - You are about to drop the column `card_id` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `default_card_id` on the `ExpenseTemplate` table. All the data in the column will be lost.
  - You are about to drop the `Card` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FortnightIncome` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentMethod` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('USER_TO_HOUSE');

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_house_id_fkey";

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_payment_method_id_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_card_id_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_category_id_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseTemplate" DROP CONSTRAINT "ExpenseTemplate_default_card_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightIncome" DROP CONSTRAINT "FortnightIncome_fortnight_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightIncome" DROP CONSTRAINT "FortnightIncome_house_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightIncome" DROP CONSTRAINT "FortnightIncome_income_template_id_fkey";

-- DropForeignKey
ALTER TABLE "FortnightIncome" DROP CONSTRAINT "FortnightIncome_user_id_fkey";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "card_id",
ADD COLUMN     "user_id" INTEGER,
ADD COLUMN     "wallet_id" INTEGER,
ALTER COLUMN "category_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseTemplate" DROP COLUMN "default_card_id",
ADD COLUMN     "user_id" INTEGER,
ADD COLUMN     "wallet_id" INTEGER;

-- AlterTable
ALTER TABLE "Fortnight" ADD COLUMN     "user_id" INTEGER;

-- AlterTable
ALTER TABLE "IncomeTemplate" ADD COLUMN     "house_id" INTEGER;

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "house_id" INTEGER,
ADD COLUMN     "user_id" INTEGER;

-- DropTable
DROP TABLE "Card";

-- DropTable
DROP TABLE "FortnightIncome";

-- DropTable
DROP TABLE "PaymentMethod";

-- CreateTable
CREATE TABLE "Income" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "source" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "fortnight_id" INTEGER NOT NULL,
    "income_template_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "TransferType" NOT NULL,
    "user_id" INTEGER NOT NULL,
    "house_id" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Fortnight" ADD CONSTRAINT "Fortnight_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_income_template_id_fkey" FOREIGN KEY ("income_template_id") REFERENCES "IncomeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeTemplate" ADD CONSTRAINT "IncomeTemplate_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
