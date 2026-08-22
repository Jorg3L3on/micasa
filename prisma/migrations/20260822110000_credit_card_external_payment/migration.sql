-- AlterTable
ALTER TABLE "CreditCardPayment" ADD COLUMN "adjusts_debt" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CreditCardPayment" ALTER COLUMN "source_wallet_id" DROP NOT NULL;
