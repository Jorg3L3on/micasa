/*
  Warnings:

  - A unique constraint covering the columns `[year,month,period]` on the table `Fortnight` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `period` to the `Fortnight` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FortnightPeriod" AS ENUM ('FIRST', 'SECOND');

-- DropIndex
DROP INDEX "Fortnight_start_date_end_date_key";

-- AlterTable
ALTER TABLE "ExpenseTemplate" ADD COLUMN     "applies_first_fortnight" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "applies_second_fortnight" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Fortnight" ADD COLUMN     "period" "FortnightPeriod" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Fortnight_year_month_period_key" ON "Fortnight"("year", "month", "period");
