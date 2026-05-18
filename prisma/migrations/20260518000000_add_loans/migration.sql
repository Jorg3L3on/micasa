-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('PERSONAL', 'PAYROLL');

-- CreateEnum
CREATE TYPE "LoanPaymentFrequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LoanPaymentSource" AS ENUM ('WALLET', 'PAYROLL_DEDUCTION');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanPaymentStatus" AS ENUM ('SCHEDULED', 'PAID', 'SKIPPED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "type" "LoanType" NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "principal_amount" DECIMAL(12,2) NOT NULL,
    "payment_amount" DECIMAL(12,2) NOT NULL,
    "payment_count" INTEGER NOT NULL,
    "frequency" "LoanPaymentFrequency" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "payment_source" "LoanPaymentSource" NOT NULL,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "source_wallet_id" INTEGER,
    "linked_wallet_id" INTEGER,
    "income_template_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" SERIAL NOT NULL,
    "loan_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "LoanPaymentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "paid_at" TIMESTAMP(3),
    "source_wallet_id" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_user_id_idx" ON "Loan"("user_id");

-- CreateIndex
CREATE INDEX "Loan_house_id_idx" ON "Loan"("house_id");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Loan_source_wallet_id_idx" ON "Loan"("source_wallet_id");

-- CreateIndex
CREATE INDEX "Loan_linked_wallet_id_idx" ON "Loan"("linked_wallet_id");

-- CreateIndex
CREATE INDEX "Loan_income_template_id_idx" ON "Loan"("income_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "LoanPayment_loan_id_sequence_key" ON "LoanPayment"("loan_id", "sequence");

-- CreateIndex
CREATE INDEX "LoanPayment_loan_id_idx" ON "LoanPayment"("loan_id");

-- CreateIndex
CREATE INDEX "LoanPayment_due_date_idx" ON "LoanPayment"("due_date");

-- CreateIndex
CREATE INDEX "LoanPayment_status_idx" ON "LoanPayment"("status");

-- CreateIndex
CREATE INDEX "LoanPayment_source_wallet_id_idx" ON "LoanPayment"("source_wallet_id");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_source_wallet_id_fkey" FOREIGN KEY ("source_wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_linked_wallet_id_fkey" FOREIGN KEY ("linked_wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_income_template_id_fkey" FOREIGN KEY ("income_template_id") REFERENCES "IncomeTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_source_wallet_id_fkey" FOREIGN KEY ("source_wallet_id") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
