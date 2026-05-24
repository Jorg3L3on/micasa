-- CreateTable
CREATE TABLE "CreditCardPaymentPlan" (
    "id" SERIAL NOT NULL,
    "credit_card_wallet_id" INTEGER NOT NULL,
    "fortnight_id" INTEGER NOT NULL,
    "planned_amount" DECIMAL(12,2) NOT NULL,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCardPaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardPaymentPlan_credit_card_wallet_id_fortnight_id_key" ON "CreditCardPaymentPlan"("credit_card_wallet_id", "fortnight_id");

-- CreateIndex
CREATE INDEX "CreditCardPaymentPlan_fortnight_id_idx" ON "CreditCardPaymentPlan"("fortnight_id");

-- CreateIndex
CREATE INDEX "CreditCardPaymentPlan_credit_card_wallet_id_idx" ON "CreditCardPaymentPlan"("credit_card_wallet_id");

-- CreateIndex
CREATE INDEX "CreditCardPaymentPlan_user_id_idx" ON "CreditCardPaymentPlan"("user_id");

-- CreateIndex
CREATE INDEX "CreditCardPaymentPlan_house_id_idx" ON "CreditCardPaymentPlan"("house_id");

-- AddForeignKey
ALTER TABLE "CreditCardPaymentPlan" ADD CONSTRAINT "CreditCardPaymentPlan_credit_card_wallet_id_fkey" FOREIGN KEY ("credit_card_wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardPaymentPlan" ADD CONSTRAINT "CreditCardPaymentPlan_fortnight_id_fkey" FOREIGN KEY ("fortnight_id") REFERENCES "Fortnight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
