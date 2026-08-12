-- Allow GOAL wallets under wallet_credit_card_fields_check
-- (previously only CASH/DEBIT or credit/store cards).

ALTER TABLE "Wallet" DROP CONSTRAINT "wallet_credit_card_fields_check";

ALTER TABLE "Wallet"
ADD CONSTRAINT "wallet_credit_card_fields_check"
CHECK (
  (
    "type" IN ('CREDIT_CARD', 'DEPARTMENT_STORE_CARD')
    AND "credit_limit" IS NOT NULL
    AND "credit_limit" > 0
    AND "cutoff_day" IS NOT NULL
    AND "due_day" IS NOT NULL
    AND "goal_amount" IS NULL
    AND "goal_due_date" IS NULL
  )
  OR
  (
    "type" IN ('CASH', 'DEBIT_CARD')
    AND "credit_limit" IS NULL
    AND "cutoff_day" IS NULL
    AND "due_day" IS NULL
    AND "goal_amount" IS NULL
    AND "goal_due_date" IS NULL
  )
  OR
  (
    "type" = 'GOAL'
    AND "credit_limit" IS NULL
    AND "cutoff_day" IS NULL
    AND "due_day" IS NULL
    AND "goal_amount" IS NOT NULL
    AND "goal_amount" > 0
    AND "goal_due_date" IS NOT NULL
  )
);
