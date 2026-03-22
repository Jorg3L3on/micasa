-- AlterTable
ALTER TABLE "PantryProduct" ADD COLUMN     "profeco_price_row_id" INTEGER;

-- CreateTable
CREATE TABLE "PantryProfecoPriceRow" (
    "id" SERIAL NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_detail" TEXT,
    "brand" TEXT,
    "retail_chain" TEXT,
    "state" TEXT,
    "municipality" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "observed_on" TIMESTAMP(3),
    "barcode" TEXT,
    "import_label" TEXT,
    "source_row_index" INTEGER,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantryProfecoPriceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryProfecoPriceRow_user_id_idx" ON "PantryProfecoPriceRow"("user_id");

-- CreateIndex
CREATE INDEX "PantryProfecoPriceRow_house_id_idx" ON "PantryProfecoPriceRow"("house_id");

-- CreateIndex
CREATE INDEX "PantryProfecoPriceRow_product_name_idx" ON "PantryProfecoPriceRow"("product_name");

-- CreateIndex
CREATE INDEX "PantryProfecoPriceRow_barcode_idx" ON "PantryProfecoPriceRow"("barcode");

-- CreateIndex
CREATE INDEX "PantryProduct_profeco_price_row_id_idx" ON "PantryProduct"("profeco_price_row_id");

-- AddForeignKey
ALTER TABLE "PantryProfecoPriceRow" ADD CONSTRAINT "PantryProfecoPriceRow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryProfecoPriceRow" ADD CONSTRAINT "PantryProfecoPriceRow_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryProduct" ADD CONSTRAINT "PantryProduct_profeco_price_row_id_fkey" FOREIGN KEY ("profeco_price_row_id") REFERENCES "PantryProfecoPriceRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
