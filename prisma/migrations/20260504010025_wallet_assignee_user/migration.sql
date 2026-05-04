-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "assignee_user_id" INTEGER;

-- CreateIndex
CREATE INDEX "Wallet_house_id_assignee_user_id_idx" ON "Wallet"("house_id", "assignee_user_id");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
