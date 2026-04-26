-- CreateEnum
CREATE TYPE "ShoppingStore" AS ENUM ('BODEGA_AURRERA', 'SORIANA', 'CHEDRAUI', 'WALMART', 'SAMS_CLUB');

-- AlterTable
ALTER TABLE "PantryShoppingCart" ADD COLUMN     "store" "ShoppingStore";
