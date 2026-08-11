-- CreateTable
CREATE TABLE "WalletTransfer" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "from_wallet_id" INTEGER NOT NULL,
    "to_wallet_id" INTEGER NOT NULL,
    "note" TEXT,
    "transferred_at" TIMESTAMP(3) NOT NULL,
    "exclude_from_report" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "WalletTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTransfer_from_wallet_id_idx" ON "WalletTransfer"("from_wallet_id");

-- CreateIndex
CREATE INDEX "WalletTransfer_to_wallet_id_idx" ON "WalletTransfer"("to_wallet_id");

-- CreateIndex
CREATE INDEX "WalletTransfer_user_id_idx" ON "WalletTransfer"("user_id");

-- CreateIndex
CREATE INDEX "WalletTransfer_house_id_idx" ON "WalletTransfer"("house_id");

-- CreateIndex
CREATE INDEX "WalletTransfer_transferred_at_idx" ON "WalletTransfer"("transferred_at");

-- AddForeignKey
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_from_wallet_id_fkey" FOREIGN KEY ("from_wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_to_wallet_id_fkey" FOREIGN KEY ("to_wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransfer" ADD CONSTRAINT "WalletTransfer_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce single-owner rule
ALTER TABLE "WalletTransfer"
ADD CONSTRAINT "wallet_transfer_single_owner_check"
CHECK (
  (user_id IS NOT NULL AND house_id IS NULL)
  OR
  (user_id IS NULL AND house_id IS NOT NULL)
);
