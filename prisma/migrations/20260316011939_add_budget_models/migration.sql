-- CreateEnum
CREATE TYPE "BudgetFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'CUSTOM');

-- CreateTable
CREATE TABLE "Budget" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(25) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "frequency" "BudgetFrequency" NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" SERIAL NOT NULL,
    "budget_id" INTEGER NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Budget_user_id_idx" ON "Budget"("user_id");

-- CreateIndex
CREATE INDEX "Budget_house_id_idx" ON "Budget"("house_id");

-- CreateIndex
CREATE INDEX "BudgetAllocation_budget_id_idx" ON "BudgetAllocation"("budget_id");

-- CreateIndex
CREATE INDEX "BudgetAllocation_wallet_id_idx" ON "BudgetAllocation"("wallet_id");

-- CreateIndex
CREATE INDEX "BudgetAllocation_category_id_idx" ON "BudgetAllocation"("category_id");

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
