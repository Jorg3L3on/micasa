-- Add payment_due_date and minimum_payment fields to CreditCardStatementImport
ALTER TABLE "CreditCardStatementImport"
  ADD COLUMN IF NOT EXISTS "payment_due_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "minimum_payment"  DECIMAL(12,2);
