-- CreateTable
CREATE TABLE "PantryReceipt" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "subtotal" DECIMAL(12,2),
    "discount_total" DECIMAL(12,2),
    "delivery_fee" DECIMAL(12,2),
    "grand_total" DECIMAL(12,2),
    "merchant_ref" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "purchased_at" TIMESTAMP(3),
    "user_id" INTEGER,
    "house_id" INTEGER,
    "created_by_user_id" INTEGER NOT NULL,
    "file_name" TEXT,
    "file_mime" TEXT,
    "file_data" BYTEA,
    "parse_warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryReceiptLine" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "unit_label" TEXT,
    "unit_price" DECIMAL(12,2),
    "line_total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PantryReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PantryReceipt_user_id_idx" ON "PantryReceipt"("user_id");

-- CreateIndex
CREATE INDEX "PantryReceipt_house_id_idx" ON "PantryReceipt"("house_id");

-- CreateIndex
CREATE INDEX "PantryReceipt_created_at_idx" ON "PantryReceipt"("created_at");

-- CreateIndex
CREATE INDEX "PantryReceiptLine_receipt_id_idx" ON "PantryReceiptLine"("receipt_id");

-- AddForeignKey
ALTER TABLE "PantryReceipt" ADD CONSTRAINT "PantryReceipt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryReceipt" ADD CONSTRAINT "PantryReceipt_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryReceipt" ADD CONSTRAINT "PantryReceipt_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryReceiptLine" ADD CONSTRAINT "PantryReceiptLine_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "PantryReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
