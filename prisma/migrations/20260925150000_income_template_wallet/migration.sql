-- Cartera destino de la plantilla de ingreso. Guardarla no acredita el saldo.
ALTER TABLE "IncomeTemplate" ADD COLUMN "wallet_id" INTEGER;

ALTER TABLE "IncomeTemplate"
ADD CONSTRAINT "IncomeTemplate_wallet_id_fkey"
FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "IncomeTemplate_wallet_id_idx" ON "IncomeTemplate"("wallet_id");

-- Existing incomes with a wallet were credited when that wallet was assigned.
ALTER TABLE "Income" ADD COLUMN "wallet_credited" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Income" SET "wallet_credited" = true WHERE "wallet_id" IS NOT NULL;
