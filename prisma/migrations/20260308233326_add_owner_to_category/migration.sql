-- AlterTable
-- Existing categories get user_id and house_id NULL. They will not appear in any
-- owner's list until assigned (e.g. via UPDATE ... SET user_id = ? WHERE user_id IS NULL).
ALTER TABLE "Category" ADD COLUMN     "house_id" INTEGER,
ADD COLUMN     "user_id" INTEGER;

-- CreateIndex
CREATE INDEX "Category_user_id_idx" ON "Category"("user_id");

-- CreateIndex
CREATE INDEX "Category_house_id_idx" ON "Category"("house_id");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;
