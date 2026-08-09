-- AlterTable
ALTER TABLE "Category" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN "parent_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Category_parent_id_idx" ON "Category"("parent_id");
CREATE INDEX "Category_user_id_parent_id_idx" ON "Category"("user_id", "parent_id");
CREATE INDEX "Category_house_id_parent_id_idx" ON "Category"("house_id", "parent_id");
