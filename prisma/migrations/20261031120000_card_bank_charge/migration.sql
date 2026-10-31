-- Bank charges that make a card payment larger than the recorded debt.
-- Additive: existing plans and payments stay valid while these columns are null.

CREATE TYPE "CardBankChargeReason" AS ENUM ('INTEREST', 'LATE_FEE', 'OTHER');

ALTER TABLE "CreditCardPaymentPlan" ADD COLUMN "over_debt_reason" "CardBankChargeReason";

ALTER TABLE "CreditCardPayment" ADD COLUMN "bank_charge_expense_id" INTEGER;

CREATE UNIQUE INDEX "CreditCardPayment_bank_charge_expense_id_key" ON "CreditCardPayment"("bank_charge_expense_id");

ALTER TABLE "CreditCardPayment" ADD CONSTRAINT "CreditCardPayment_bank_charge_expense_id_fkey" FOREIGN KEY ("bank_charge_expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
