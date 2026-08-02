-- Drop pantry (Despensa) module tables and enums.
-- Dependent FKs/triggers are removed via CASCADE. Linked expenses are preserved.

DROP TABLE IF EXISTS "PantryShoppingCartActivity" CASCADE;
DROP TABLE IF EXISTS "PantryShoppingCartItem" CASCADE;
DROP TABLE IF EXISTS "PantryReceiptLine" CASCADE;
DROP TABLE IF EXISTS "PantryReceipt" CASCADE;
DROP TABLE IF EXISTS "PantryShoppingCart" CASCADE;
DROP TABLE IF EXISTS "PantryProduct" CASCADE;

DROP TYPE IF EXISTS "ShoppingCartActivityAction";
DROP TYPE IF EXISTS "ShoppingCartStatus";
DROP TYPE IF EXISTS "ShoppingStore";
