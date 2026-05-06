-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "temporary_credit_limit" DECIMAL(10,2),
ADD COLUMN "temporary_credit_limit_as_of" TIMESTAMP(3);
