-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "cutoff_day" INTEGER,
ADD COLUMN     "due_day" INTEGER;

-- AlterTable
ALTER TABLE "ExpenseTemplate" ADD COLUMN     "cutoff_day" INTEGER,
ADD COLUMN     "due_day" INTEGER,
ADD COLUMN     "is_subscription" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FortnightIncome" ADD COLUMN     "is_deduction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "related_loan" TEXT;
