-- DropForeignKey
ALTER TABLE "ExpenseTemplate" DROP CONSTRAINT "ExpenseTemplate_category_id_fkey";

-- DropIndex
DROP INDEX "Card_active_idx";

-- DropIndex
DROP INDEX "Category_name_key";

-- DropIndex
DROP INDEX "Expense_card_id_idx";

-- DropIndex
DROP INDEX "Expense_category_id_idx";

-- DropIndex
DROP INDEX "Expense_fortnight_id_idx";

-- DropIndex
DROP INDEX "Expense_is_paid_idx";

-- DropIndex
DROP INDEX "ExpenseTemplate_active_idx";

-- DropIndex
DROP INDEX "ExpenseTemplate_category_id_idx";

-- DropIndex
DROP INDEX "ExpenseTemplate_default_card_id_idx";

-- DropIndex
DROP INDEX "ExpenseTemplate_name_key";

-- DropIndex
DROP INDEX "Fortnight_closed_idx";

-- DropIndex
DROP INDEX "Fortnight_year_month_idx";

-- DropIndex
DROP INDEX "Fortnight_year_month_period_key";

-- DropIndex
DROP INDEX "FortnightIncome_fortnight_id_idx";

-- DropIndex
DROP INDEX "FortnightIncome_house_id_idx";

-- DropIndex
DROP INDEX "FortnightIncome_user_id_idx";

-- DropIndex
DROP INDEX "HouseMember_house_id_idx";

-- DropIndex
DROP INDEX "HouseMember_user_id_idx";

-- DropIndex
DROP INDEX "User_active_idx";

-- DropIndex
DROP INDEX "User_name_key";

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "house_id" INTEGER;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "house_id" INTEGER;

-- AlterTable
ALTER TABLE "ExpenseTemplate" ADD COLUMN     "house_id" INTEGER,
ALTER COLUMN "category_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Fortnight" ADD COLUMN     "house_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Fortnight" ADD CONSTRAINT "Fortnight_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseTemplate" ADD CONSTRAINT "ExpenseTemplate_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;
