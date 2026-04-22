-- Add wallet_id to Income so receiving payroll can credit a wallet
ALTER TABLE "Income" ADD COLUMN IF NOT EXISTS "wallet_id" INTEGER;

ALTER TABLE "Income"
  ADD CONSTRAINT "Income_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Income_wallet_id_idx" ON "Income"("wallet_id");
