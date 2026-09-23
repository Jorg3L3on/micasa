-- A stored planned_amount of 0 stays "no plan". This flag is the explicit
-- "este ciclo es $0" declaration, distinct from clearing the override.
ALTER TABLE "CreditCardPaymentPlan" ADD COLUMN "declared_zero" BOOLEAN NOT NULL DEFAULT false;
