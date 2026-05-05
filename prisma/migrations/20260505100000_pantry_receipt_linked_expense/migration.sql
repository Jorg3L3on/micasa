-- AlterTable
ALTER TABLE "PantryReceipt" ADD COLUMN "linked_expense_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "PantryReceipt_linked_expense_id_key" ON "PantryReceipt"("linked_expense_id");

-- CreateIndex
CREATE INDEX "PantryReceipt_linked_expense_id_idx" ON "PantryReceipt"("linked_expense_id");

-- AddForeignKey
ALTER TABLE "PantryReceipt" ADD CONSTRAINT "PantryReceipt_linked_expense_id_fkey" FOREIGN KEY ("linked_expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
