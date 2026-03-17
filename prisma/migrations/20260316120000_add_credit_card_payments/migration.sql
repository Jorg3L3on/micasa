ALTER TABLE "Wallet"
ADD COLUMN "credit_limit" DECIMAL(10, 2);

UPDATE "Wallet"
SET "credit_limit" = GREATEST(COALESCE("amount", 0), 1)
WHERE "type" IN ('CREDIT_CARD', 'DEPARTMENT_STORE_CARD')
  AND ("credit_limit" IS NULL OR "credit_limit" <= 0);

UPDATE "Wallet"
SET "cutoff_day" = COALESCE("cutoff_day", 1),
    "due_day" = COALESCE("due_day", 16)
WHERE "type" IN ('CREDIT_CARD', 'DEPARTMENT_STORE_CARD')
  AND ("cutoff_day" IS NULL OR "due_day" IS NULL);

UPDATE "Wallet"
SET "credit_limit" = NULL,
    "cutoff_day" = NULL,
    "due_day" = NULL
WHERE "type" IN ('CASH', 'DEBIT_CARD');

ALTER TABLE "Wallet"
ADD CONSTRAINT "wallet_credit_card_fields_check"
CHECK (
  (
    "type" IN ('CREDIT_CARD', 'DEPARTMENT_STORE_CARD')
    AND "credit_limit" IS NOT NULL
    AND "credit_limit" > 0
    AND "cutoff_day" IS NOT NULL
    AND "due_day" IS NOT NULL
  )
  OR
  (
    "type" IN ('CASH', 'DEBIT_CARD')
    AND "credit_limit" IS NULL
    AND "cutoff_day" IS NULL
    AND "due_day" IS NULL
  )
);

CREATE TABLE "CreditCardPayment" (
  "id" SERIAL NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "credit_card_wallet_id" INTEGER NOT NULL,
  "source_wallet_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "house_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CreditCardPayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreditCardPayment"
ADD CONSTRAINT "credit_card_payment_single_owner_check"
CHECK (
  ("user_id" IS NOT NULL AND "house_id" IS NULL)
  OR
  ("user_id" IS NULL AND "house_id" IS NOT NULL)
);

ALTER TABLE "CreditCardPayment"
ADD CONSTRAINT "CreditCardPayment_credit_card_wallet_id_fkey"
FOREIGN KEY ("credit_card_wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditCardPayment"
ADD CONSTRAINT "CreditCardPayment_source_wallet_id_fkey"
FOREIGN KEY ("source_wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditCardPayment"
ADD CONSTRAINT "CreditCardPayment_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditCardPayment"
ADD CONSTRAINT "CreditCardPayment_house_id_fkey"
FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Wallet_user_id_type_active_idx" ON "Wallet"("user_id", "type", "active");
CREATE INDEX "Wallet_house_id_type_active_idx" ON "Wallet"("house_id", "type", "active");
CREATE INDEX "CreditCardPayment_credit_card_wallet_id_paid_at_idx" ON "CreditCardPayment"("credit_card_wallet_id", "paid_at");
CREATE INDEX "CreditCardPayment_source_wallet_id_paid_at_idx" ON "CreditCardPayment"("source_wallet_id", "paid_at");
CREATE INDEX "CreditCardPayment_user_id_paid_at_idx" ON "CreditCardPayment"("user_id", "paid_at");
CREATE INDEX "CreditCardPayment_house_id_paid_at_idx" ON "CreditCardPayment"("house_id", "paid_at");
