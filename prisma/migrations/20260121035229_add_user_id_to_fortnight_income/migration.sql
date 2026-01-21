/*
  Warnings:

  - Added the required column `user_id` to the `FortnightIncome` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FortnightIncome" ADD COLUMN     "user_id" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "FortnightIncome_user_id_idx" ON "FortnightIncome"("user_id");

-- AddForeignKey
ALTER TABLE "FortnightIncome" ADD CONSTRAINT "FortnightIncome_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
