-- Store audit timestamps as Mexico City wall-clock values.
--
-- The app wants the raw database value to match local civil time. Prisma's
-- client-side `now()` / `@updatedAt` behavior serializes instants, which can
-- write UTC wall-clock values into timestamp columns. These columns use
-- database-generated Mexico City local time instead.

SET LOCAL TIME ZONE 'America/Mexico_City';

CREATE OR REPLACE FUNCTION set_micasa_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('America/Mexico_City'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE "User"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Fortnight"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Category"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "ExpenseTemplate"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Expense"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Income"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "IncomeTemplate"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "House"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "HouseMember"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Wallet"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "CreditCardPaymentPlan"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "CreditCardPaymentPlan";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "CreditCardPaymentPlan"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "Budget"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "BudgetPeriod"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "BudgetAllocation"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Transfer"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "CreditCardPayment"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "Loan"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "Loan";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "Loan"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "LoanPayment"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "LoanPayment";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "LoanPayment"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "CreditCardStatementImport"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

ALTER TABLE "PantryReceipt"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "PantryReceipt";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "PantryReceipt"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "PantryProduct"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "PantryProduct";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "PantryProduct"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "PantryShoppingCart"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "PantryShoppingCart";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "PantryShoppingCart"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "PantryShoppingCartItem"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now()),
  ALTER COLUMN "updated_at" TYPE TIMESTAMP(3) USING "updated_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "updated_at" SET DEFAULT timezone('America/Mexico_City'::text, now());

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "PantryShoppingCartItem";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "PantryShoppingCartItem"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();

ALTER TABLE "PantryShoppingCartActivity"
  ALTER COLUMN "created_at" TYPE TIMESTAMP(3) USING "created_at" AT TIME ZONE 'America/Mexico_City',
  ALTER COLUMN "created_at" SET DEFAULT timezone('America/Mexico_City'::text, now());
