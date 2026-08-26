-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('EXPENSE', 'INCOME');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "kind" "CategoryKind" NOT NULL DEFAULT 'EXPENSE';

-- AlterTable
ALTER TABLE "Income" ADD COLUMN "category_id" INTEGER;

-- AlterTable
ALTER TABLE "IncomeTemplate" ADD COLUMN "category_id" INTEGER;

-- CreateIndex
CREATE INDEX "Category_user_id_kind_idx" ON "Category"("user_id", "kind");
CREATE INDEX "Category_house_id_kind_idx" ON "Category"("house_id", "kind");
CREATE INDEX "Income_category_id_idx" ON "Income"("category_id");
CREATE INDEX "IncomeTemplate_category_id_idx" ON "IncomeTemplate"("category_id");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncomeTemplate" ADD CONSTRAINT "IncomeTemplate_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill default income categories for every existing owner that already has categories
INSERT INTO "Category" (name, icon, active, sort_order, parent_id, user_id, house_id, kind)
SELECT v.name, v.icon, true, v.sort_order, NULL, o.user_id, o.house_id, 'INCOME'::"CategoryKind"
FROM (
  SELECT DISTINCT "user_id", "house_id"
  FROM "Category"
  WHERE "user_id" IS NOT NULL OR "house_id" IS NOT NULL
) o
CROSS JOIN (
  VALUES
    ('Salario'::text, 'BANKNOTE'::text, 0),
    ('Depósito', 'BANKNOTE_ARROW_DOWN', 1),
    ('Cobro de interés', 'PERCENT', 2),
    ('Aguinaldo', 'GIFT', 3),
    ('Otro ingreso', 'BOX', 4)
) AS v(name, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM "Category" c
  WHERE c.kind = 'INCOME'
    AND c.name = v.name
    AND c.user_id IS NOT DISTINCT FROM o.user_id
    AND c.house_id IS NOT DISTINCT FROM o.house_id
);
