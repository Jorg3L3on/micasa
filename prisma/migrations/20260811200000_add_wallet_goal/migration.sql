-- AlterEnum
ALTER TYPE "PaymentMethodType" ADD VALUE 'GOAL';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "goal_amount" DECIMAL(10,2),
ADD COLUMN "goal_due_date" TIMESTAMP(3);
