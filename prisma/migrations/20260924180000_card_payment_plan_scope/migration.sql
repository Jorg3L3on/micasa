-- Planned card payment validity. Nullable columns; existing rows become this_cycle.
-- The anchor date stays null and is derived from the stored fortnight at read time.

CREATE TYPE "CardPaymentPlanScope" AS ENUM ('THIS_CYCLE', 'N_CYCLES', 'UNTIL_DATE');

ALTER TABLE "CreditCardPaymentPlan" ADD COLUMN "scope" "CardPaymentPlanScope";
ALTER TABLE "CreditCardPaymentPlan" ADD COLUMN "cycle_count" INTEGER;
ALTER TABLE "CreditCardPaymentPlan" ADD COLUMN "valid_until" DATE;
ALTER TABLE "CreditCardPaymentPlan" ADD COLUMN "anchor_statement_end" DATE;

UPDATE "CreditCardPaymentPlan" SET "scope" = 'THIS_CYCLE' WHERE "scope" IS NULL;
