-- Improve statement import lookups used by monthly planner due-payments.
CREATE INDEX "CreditCardStatementImport_wallet_id_payment_due_date_idx"
ON "CreditCardStatementImport"("wallet_id", "payment_due_date");

CREATE INDEX "CreditCardStatementImport_user_id_payment_due_date_idx"
ON "CreditCardStatementImport"("user_id", "payment_due_date");

CREATE INDEX "CreditCardStatementImport_house_id_payment_due_date_idx"
ON "CreditCardStatementImport"("house_id", "payment_due_date");
