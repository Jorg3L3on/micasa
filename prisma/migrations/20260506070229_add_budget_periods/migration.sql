-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "recurrent" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BudgetPeriod" (
    "id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetPeriod_budget_id_idx" ON "BudgetPeriod"("budget_id");

-- CreateIndex
CREATE INDEX "BudgetPeriod_start_date_end_date_idx" ON "BudgetPeriod"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "BudgetPeriod" ADD CONSTRAINT "BudgetPeriod_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
