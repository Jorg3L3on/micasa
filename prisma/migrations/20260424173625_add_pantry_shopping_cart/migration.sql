-- CreateEnum
CREATE TYPE "ShoppingCartStatus" AS ENUM ('IN_PROGRESS', 'BOUGHT', 'CANCELED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ShoppingCartActivityAction" AS ENUM ('CART_CREATED', 'CART_UPDATED', 'CART_STATUS_CHANGED', 'CART_DELETED', 'ITEM_ADDED', 'ITEM_UPDATED', 'ITEM_CHECKED', 'ITEM_UNCHECKED', 'ITEM_REMOVED');

-- CreateTable
CREATE TABLE "PantryShoppingCart" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ShoppingCartStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_by_user_id" INTEGER NOT NULL,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryShoppingCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryShoppingCartItem" (
    "id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "unit_label" TEXT,
    "unit_price" DECIMAL(12,2),
    "notes" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" INTEGER NOT NULL,
    "updated_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryShoppingCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryShoppingCartActivity" (
    "id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "item_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "action" "ShoppingCartActivityAction" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryShoppingCartActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryShoppingCart_user_id_idx" ON "PantryShoppingCart"("user_id");

-- CreateIndex
CREATE INDEX "PantryShoppingCart_house_id_idx" ON "PantryShoppingCart"("house_id");

-- CreateIndex
CREATE INDEX "PantryShoppingCart_status_idx" ON "PantryShoppingCart"("status");

-- CreateIndex
CREATE INDEX "PantryShoppingCart_created_at_idx" ON "PantryShoppingCart"("created_at");

-- CreateIndex
CREATE INDEX "PantryShoppingCartItem_cart_id_idx" ON "PantryShoppingCartItem"("cart_id");

-- CreateIndex
CREATE INDEX "PantryShoppingCartItem_product_id_idx" ON "PantryShoppingCartItem"("product_id");

-- CreateIndex
CREATE INDEX "PantryShoppingCartActivity_cart_id_created_at_idx" ON "PantryShoppingCartActivity"("cart_id", "created_at");

-- CreateIndex
CREATE INDEX "PantryShoppingCartActivity_item_id_idx" ON "PantryShoppingCartActivity"("item_id");

-- AddForeignKey
ALTER TABLE "PantryShoppingCart" ADD CONSTRAINT "PantryShoppingCart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCart" ADD CONSTRAINT "PantryShoppingCart_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCart" ADD CONSTRAINT "PantryShoppingCart_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCart" ADD CONSTRAINT "PantryShoppingCart_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCartItem" ADD CONSTRAINT "PantryShoppingCartItem_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "PantryShoppingCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCartItem" ADD CONSTRAINT "PantryShoppingCartItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "PantryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCartItem" ADD CONSTRAINT "PantryShoppingCartItem_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCartItem" ADD CONSTRAINT "PantryShoppingCartItem_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCartActivity" ADD CONSTRAINT "PantryShoppingCartActivity_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "PantryShoppingCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryShoppingCartActivity" ADD CONSTRAINT "PantryShoppingCartActivity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
