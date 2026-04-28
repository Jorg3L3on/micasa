-- Pantry Phase 2 data model upgrades
ALTER TABLE "PantryReceipt"
ADD COLUMN "source_type" TEXT,
ADD COLUMN "linked_cart_id" INTEGER;

ALTER TABLE "PantryReceipt"
ADD CONSTRAINT "PantryReceipt_linked_cart_id_fkey"
FOREIGN KEY ("linked_cart_id") REFERENCES "PantryShoppingCart"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PantryReceipt_linked_cart_id_idx" ON "PantryReceipt"("linked_cart_id");

ALTER TABLE "PantryReceiptLine"
ADD COLUMN "normalized_name" TEXT,
ADD COLUMN "normalized_unit" TEXT;

ALTER TABLE "PantryProduct"
ADD COLUMN "normalized_name" TEXT,
ADD COLUMN "normalized_unit" TEXT;
