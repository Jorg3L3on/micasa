-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "loan_payment_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_loan_payment_id_key" ON "Expense"("loan_payment_id");

-- CreateIndex
CREATE INDEX "Expense_loan_payment_id_idx" ON "Expense"("loan_payment_id");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_loan_payment_id_fkey" FOREIGN KEY ("loan_payment_id") REFERENCES "LoanPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
