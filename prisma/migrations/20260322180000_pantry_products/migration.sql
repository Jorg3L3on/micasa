-- CreateTable
CREATE TABLE "PantryProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "barcode" TEXT,
    "brand" TEXT,
    "unit_label" TEXT,
    "default_unit_price" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryProduct_user_id_idx" ON "PantryProduct"("user_id");

-- CreateIndex
CREATE INDEX "PantryProduct_house_id_idx" ON "PantryProduct"("house_id");

-- AddForeignKey
ALTER TABLE "PantryProduct" ADD CONSTRAINT "PantryProduct_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryProduct" ADD CONSTRAINT "PantryProduct_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;
