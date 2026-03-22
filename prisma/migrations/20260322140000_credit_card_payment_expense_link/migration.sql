-- AlterTable
ALTER TABLE "CreditCardPayment" ADD COLUMN "expense_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardPayment_expense_id_key" ON "CreditCardPayment"("expense_id");

-- AddForeignKey
ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
