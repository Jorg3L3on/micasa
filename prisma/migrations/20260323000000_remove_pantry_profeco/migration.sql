-- Remove PROFECO reference from pantry products, then drop imported rows table.

ALTER TABLE "PantryProduct" DROP CONSTRAINT IF EXISTS "PantryProduct_profeco_price_row_id_fkey";

DROP INDEX IF EXISTS "PantryProduct_profeco_price_row_id_idx";

ALTER TABLE "PantryProduct" DROP COLUMN IF EXISTS "profeco_price_row_id";

DROP TABLE IF EXISTS "PantryProfecoPriceRow";
