-- CreateEnum
CREATE TYPE "CreditCardInstallmentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CreditCardInstallmentPlanPaymentStatus" AS ENUM ('SCHEDULED', 'PAID');

-- CreateTable
CREATE TABLE "CreditCardInstallmentPlan" (
    "id" SERIAL NOT NULL,
    "credit_card_wallet_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "installment_amount" DECIMAL(10,2) NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "paid_installments" INTEGER NOT NULL DEFAULT 0,
    "already_in_card_balance" BOOLEAN NOT NULL DEFAULT false,
    "status" "CreditCardInstallmentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "CreditCardInstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardInstallmentPlanPayment" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "CreditCardInstallmentPlanPaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paid_at" TIMESTAMP(3),
    "credit_card_payment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT timezone('America/Mexico_City'::text, now()),

    CONSTRAINT "CreditCardInstallmentPlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditCardInstallmentPlan_credit_card_wallet_id_status_idx" ON "CreditCardInstallmentPlan"("credit_card_wallet_id", "status");

-- CreateIndex
CREATE INDEX "CreditCardInstallmentPlan_user_id_idx" ON "CreditCardInstallmentPlan"("user_id");

-- CreateIndex
CREATE INDEX "CreditCardInstallmentPlan_house_id_idx" ON "CreditCardInstallmentPlan"("house_id");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardInstallmentPlanPayment_credit_card_payment_id_key" ON "CreditCardInstallmentPlanPayment"("credit_card_payment_id");

-- CreateIndex
CREATE INDEX "CreditCardInstallmentPlanPayment_plan_id_idx" ON "CreditCardInstallmentPlanPayment"("plan_id");

-- CreateIndex
CREATE INDEX "CreditCardInstallmentPlanPayment_due_date_idx" ON "CreditCardInstallmentPlanPayment"("due_date");

-- CreateIndex
CREATE INDEX "CreditCardInstallmentPlanPayment_status_idx" ON "CreditCardInstallmentPlanPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardInstallmentPlanPayment_plan_id_sequence_key" ON "CreditCardInstallmentPlanPayment"("plan_id", "sequence");

-- AddForeignKey
ALTER TABLE "CreditCardInstallmentPlan" ADD CONSTRAINT "CreditCardInstallmentPlan_credit_card_wallet_id_fkey" FOREIGN KEY ("credit_card_wallet_id") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardInstallmentPlan" ADD CONSTRAINT "CreditCardInstallmentPlan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardInstallmentPlan" ADD CONSTRAINT "CreditCardInstallmentPlan_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardInstallmentPlanPayment" ADD CONSTRAINT "CreditCardInstallmentPlanPayment_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "CreditCardInstallmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardInstallmentPlanPayment" ADD CONSTRAINT "CreditCardInstallmentPlanPayment_credit_card_payment_id_fkey" FOREIGN KEY ("credit_card_payment_id") REFERENCES "CreditCardPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
