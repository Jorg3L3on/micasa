-- CreateEnum
CREATE TYPE "LenderPaymentMode" AS ENUM ('WALLET', 'EXTERNAL');

-- CreateTable
CREATE TABLE "Lender" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "provider_icon_key" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "Lender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LenderPayment" (
    "id" SERIAL NOT NULL,
    "lender_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "mode" "LenderPaymentMode" NOT NULL,
    "source_wallet_id" INTEGER,
    "expense_id" INTEGER,
    "note" TEXT,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "LenderPayment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "lender_id" INTEGER;

-- AlterTable
ALTER TABLE "LoanPayment" ADD COLUMN "lender_payment_id" INTEGER;

-- CreateIndex
CREATE INDEX "Lender_user_id_idx" ON "Lender"("user_id");

-- CreateIndex
CREATE INDEX "Lender_house_id_idx" ON "Lender"("house_id");

-- CreateIndex
CREATE INDEX "Lender_user_id_name_idx" ON "Lender"("user_id", "name");

-- CreateIndex
CREATE INDEX "Lender_house_id_name_idx" ON "Lender"("house_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LenderPayment_expense_id_key" ON "LenderPayment"("expense_id");

-- CreateIndex
CREATE INDEX "LenderPayment_lender_id_paid_at_idx" ON "LenderPayment"("lender_id", "paid_at");

-- CreateIndex
CREATE INDEX "LenderPayment_source_wallet_id_idx" ON "LenderPayment"("source_wallet_id");

-- CreateIndex
CREATE INDEX "LenderPayment_user_id_idx" ON "LenderPayment"("user_id");

-- CreateIndex
CREATE INDEX "LenderPayment_house_id_idx" ON "LenderPayment"("house_id");

-- CreateIndex
CREATE INDEX "Loan_lender_id_idx" ON "Loan"("lender_id");

-- CreateIndex
CREATE INDEX "LoanPayment_lender_payment_id_idx" ON "LoanPayment"("lender_payment_id");

-- AddForeignKey
ALTER TABLE "Lender" ADD CONSTRAINT "Lender_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lender" ADD CONSTRAINT "Lender_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderPayment" ADD CONSTRAINT "LenderPayment_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "Lender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderPayment" ADD CONSTRAINT "LenderPayment_source_wallet_id_fkey" FOREIGN KEY ("source_wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderPayment" ADD CONSTRAINT "LenderPayment_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderPayment" ADD CONSTRAINT "LenderPayment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LenderPayment" ADD CONSTRAINT "LenderPayment_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "Lender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_lender_payment_id_fkey" FOREIGN KEY ("lender_payment_id") REFERENCES "LenderPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lender"
ADD CONSTRAINT "lender_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

ALTER TABLE "LenderPayment"
ADD CONSTRAINT "lender_payment_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);

-- Backfill: one Lender per owner + case-insensitive normalized name.
INSERT INTO "Lender" ("name", "user_id", "house_id")
SELECT DISTINCT ON (
  "user_id",
  "house_id",
  lower(btrim(regexp_replace("lender", '\s+', ' ', 'g')))
)
  btrim(regexp_replace("lender", '\s+', ' ', 'g')),
  "user_id",
  "house_id"
FROM "Loan"
WHERE btrim("lender") <> ''
ORDER BY
  "user_id",
  "house_id",
  lower(btrim(regexp_replace("lender", '\s+', ' ', 'g'))),
  "id";

UPDATE "Loan" AS l
SET
  "lender_id" = le."id",
  "lender" = le."name"
FROM "Lender" AS le
WHERE l."user_id" IS NOT DISTINCT FROM le."user_id"
  AND l."house_id" IS NOT DISTINCT FROM le."house_id"
  AND lower(btrim(regexp_replace(l."lender", '\s+', ' ', 'g'))) = lower(le."name");
