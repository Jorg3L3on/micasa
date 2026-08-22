-- CreateEnum
CREATE TYPE "CreditCardScheduledPaymentStatus" AS ENUM ('SCHEDULED', 'PAID');

-- CreateTable
CREATE TABLE "CreditCardScheduledPayment" (
    "id" SERIAL NOT NULL,
    "credit_card_wallet_id" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "label" TEXT,
    "status" "CreditCardScheduledPaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paid_at" TIMESTAMP(3),
    "credit_card_payment_id" INTEGER,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "CreditCardScheduledPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardScheduledPayment_credit_card_payment_id_key" ON "CreditCardScheduledPayment"("credit_card_payment_id");

-- CreateIndex
CREATE INDEX "CreditCardScheduledPayment_credit_card_wallet_id_due_date_idx" ON "CreditCardScheduledPayment"("credit_card_wallet_id", "due_date");

-- CreateIndex
CREATE INDEX "CreditCardScheduledPayment_credit_card_wallet_id_status_idx" ON "CreditCardScheduledPayment"("credit_card_wallet_id", "status");

-- CreateIndex
CREATE INDEX "CreditCardScheduledPayment_user_id_idx" ON "CreditCardScheduledPayment"("user_id");

-- CreateIndex
CREATE INDEX "CreditCardScheduledPayment_house_id_idx" ON "CreditCardScheduledPayment"("house_id");

-- AddForeignKey
ALTER TABLE "CreditCardScheduledPayment" ADD CONSTRAINT "CreditCardScheduledPayment_credit_card_wallet_id_fkey" FOREIGN KEY ("credit_card_wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardScheduledPayment" ADD CONSTRAINT "CreditCardScheduledPayment_credit_card_payment_id_fkey" FOREIGN KEY ("credit_card_payment_id") REFERENCES "CreditCardPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardScheduledPayment" ADD CONSTRAINT "CreditCardScheduledPayment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardScheduledPayment" ADD CONSTRAINT "CreditCardScheduledPayment_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TRIGGER IF EXISTS set_micasa_updated_at ON "CreditCardScheduledPayment";
CREATE TRIGGER set_micasa_updated_at
BEFORE UPDATE ON "CreditCardScheduledPayment"
FOR EACH ROW EXECUTE FUNCTION set_micasa_updated_at();
